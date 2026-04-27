import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/inbox GET handler.
 *
 * Verifies behavior at the route boundary:
 *  - 401 when unauthenticated
 *  - Defensive null handling for legacy rows (Call.duration null,
 *    Conversation.lastMessageAt null)
 *  - Case-insensitive voicemail classification
 *
 * Prisma + next-auth are mocked at the module boundary.
 */

// ---- Mocks ---------------------------------------------------------------
const { mockConversationFindMany, mockCallFindMany, mockGetServerSession } = vi.hoisted(() => ({
    mockConversationFindMany: vi.fn(),
    mockCallFindMany: vi.fn(),
    mockGetServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        conversation: { findMany: mockConversationFindMany },
        call: { findMany: mockCallFindMany },
    },
    // Minimal withPrismaRetry mirroring the real one: retry once on a
    // connection-error code so tests can prove retry behavior without
    // pulling in the full Prisma engine.
    withPrismaRetry: async <T,>(fn: () => Promise<T>, max = 3): Promise<T> => {
        let lastErr: any;
        for (let i = 0; i < max; i++) {
            try { return await fn(); }
            catch (e: any) {
                lastErr = e;
                const transient = e?.code === "P1001" || e?.code === "P1017"
                    || /Can't reach database|timed out|max clients/i.test(e?.message ?? "");
                if (!transient) throw e;
            }
        }
        throw lastErr;
    },
}));

vi.mock("next-auth", () => ({
    getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
    authOptions: {},
}));

// ---- Imports under test --------------------------------------------------
import { GET } from "@/app/api/inbox/route";

// ---- Helpers -------------------------------------------------------------
function fakeRequest(): Request {
    return new Request("http://localhost/api/inbox");
}

const VALID_SESSION = { user: { id: "user-1", email: "agent@test.com" } };

beforeEach(() => {
    vi.clearAllMocks();
    mockConversationFindMany.mockResolvedValue([]);
    mockCallFindMany.mockResolvedValue([]);
});

// ---- Tests ---------------------------------------------------------------
describe("GET /api/inbox", () => {
    it("returns 401 when no session", async () => {
        mockGetServerSession.mockResolvedValue(null);
        const res = await GET(fakeRequest());
        expect(res.status).toBe(401);
    });

    it("returns 200 with empty array when authed and no data", async () => {
        mockGetServerSession.mockResolvedValue(VALID_SESSION);
        const res = await GET(fakeRequest());
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
    });

    it("formats Voicemail preview as '0:00' when duration is null (legacy row)", async () => {
        mockGetServerSession.mockResolvedValue(VALID_SESSION);
        mockCallFindMany.mockResolvedValue([
            {
                id: "call-1",
                fromNumber: "+15551234567",
                toNumber: "+15559999999",
                direction: "INBOUND",
                status: "voicemail",
                outcome: null,
                duration: null, // legacy row, schema default never applied
                recordingUrl: null,
                createdAt: new Date("2026-04-27T10:00:00Z"),
                leadId: null,
                lead: null,
                user: null,
            },
        ]);

        const res = await GET(fakeRequest());
        const items = await res.json();
        expect(res.status).toBe(200);
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe("voicemail");
        expect(items[0].preview).toBe("Voicemail (0:00)");
        expect(items[0].preview).not.toContain("NaN");
    });

    it("classifies outcome='Left Voicemail' as voicemail type", async () => {
        // Mirrors the actual codebase usage: `outcome: "Left Voicemail"` is set
        // by the dialer-logic disposition handler. `status` may remain as
        // `completed` while outcome carries the voicemail label.
        mockGetServerSession.mockResolvedValue(VALID_SESSION);
        mockCallFindMany.mockResolvedValue([
            {
                id: "call-2",
                fromNumber: "+15551234567",
                toNumber: "+15559999999",
                direction: "OUTBOUND",
                status: "completed",
                outcome: "Left Voicemail",
                duration: 30,
                recordingUrl: null,
                createdAt: new Date("2026-04-27T10:00:00Z"),
                leadId: null,
                lead: null,
                user: null,
            },
        ]);

        const res = await GET(fakeRequest());
        const items = await res.json();
        expect(items[0].type).toBe("voicemail");
        expect(items[0].preview).toBe("Voicemail (0:30)");
    });

    it("does not crash when Conversation.lastMessageAt is null (legacy row)", async () => {
        mockGetServerSession.mockResolvedValue(VALID_SESSION);
        mockConversationFindMany.mockResolvedValue([
            {
                id: "conv-1",
                contactPhone: "+15551234567",
                contactId: null,
                contact: null,
                lastMessageAt: null, // legacy row
                unreadCount: 0,
                messages: [
                    { body: "hi", createdAt: new Date("2026-04-27T09:00:00Z"), direction: "INBOUND" },
                ],
            },
            {
                id: "conv-2",
                contactPhone: "+15552345678",
                contactId: null,
                contact: null,
                lastMessageAt: new Date("2026-04-27T11:00:00Z"),
                unreadCount: 1,
                messages: [
                    { body: "hello", createdAt: new Date("2026-04-27T11:00:00Z"), direction: "INBOUND" },
                ],
            },
        ]);

        const res = await GET(fakeRequest());
        expect(res.status).toBe(200);
        const items = await res.json();
        expect(items).toHaveLength(2);
        // Item with valid lastMessageAt sorts above item with null
        expect(items[0].id).toBe("sms-conv-2");
        expect(items[1].id).toBe("sms-conv-1");
    });

    it("returns 500 on Prisma error (no unhandled crash)", async () => {
        mockGetServerSession.mockResolvedValue(VALID_SESSION);
        mockCallFindMany.mockRejectedValue(new Error("DB exploded"));
        const res = await GET(fakeRequest());
        expect(res.status).toBe(500);
    });

    it("retries through a transient Prisma connection error (Vercel cold start)", async () => {
        // Symptom in production: first Prisma call after a cold start fails
        // with "Can't reach database" or "timed out" — transient. The other
        // routes wrap their queries in `withPrismaRetry` for exactly this
        // case; the inbox route originally did not, surfacing as a generic
        // 500 → "Inbox Error: Could not load inbox" toast for the user.
        mockGetServerSession.mockResolvedValue(VALID_SESSION);

        let callAttempt = 0;
        mockCallFindMany.mockImplementation(async () => {
            callAttempt++;
            if (callAttempt === 1) {
                const err: any = new Error("Can't reach database server");
                err.code = "P1001";
                throw err;
            }
            return [];
        });

        let convAttempt = 0;
        mockConversationFindMany.mockImplementation(async () => {
            convAttempt++;
            if (convAttempt === 1) {
                const err: any = new Error("Can't reach database server");
                err.code = "P1001";
                throw err;
            }
            return [];
        });

        const res = await GET(fakeRequest());
        expect(res.status).toBe(200);
        expect(callAttempt).toBeGreaterThanOrEqual(2); // proves retry ran
    });

    it("surfaces a debuggable error body (not just status) so production logs can tell us what broke", async () => {
        mockGetServerSession.mockResolvedValue(VALID_SESSION);
        const err: any = new Error("Specific Prisma message");
        err.code = "P2024"; // pool timeout
        mockCallFindMany.mockRejectedValue(err);

        const res = await GET(fakeRequest());
        expect(res.status).toBe(500);
        const body = await res.json();
        // Must include something operators can correlate with logs
        expect(body).toHaveProperty("error");
        expect(JSON.stringify(body)).toMatch(/P2024|Specific Prisma message|Server Error/);
    });
});
