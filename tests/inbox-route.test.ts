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
});
