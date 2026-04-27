import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/twilio/inbound POST handler — the inbound voice webhook.
 *
 * Goals:
 *  - Lock down the TwiML structure: <Dial><Client>{owner.id}</Client>...</Dial>
 *  - Verify the Client identity matches the user.id used by the access-token
 *    route (api/voice/token), preventing the "device never receives the call"
 *    failure mode.
 *  - Verify the widened presence threshold (120s) keeps the owner classified
 *    online during the heartbeat + write-throttle skew window that previously
 *    triggered the PSTN fallback or hangup branch.
 */

// ---- Hoisted mocks -------------------------------------------------------
const {
    mockTwilioLogCreate, mockTwilioLogUpdate,
    mockLeadFindUnique, mockLeadCreate,
    mockNumberPoolFindUnique,
    mockUserFindFirst, mockUserFindUnique,
    mockCallCreate, mockCallFindFirst,
    mockPushSubscriptionFindMany,
    mockFindLeadByPhone, mockValidateTwilioRequest,
    mockSendPushNotification,
} = vi.hoisted(() => ({
    mockTwilioLogCreate: vi.fn(),
    mockTwilioLogUpdate: vi.fn(),
    mockLeadFindUnique: vi.fn(),
    mockLeadCreate: vi.fn(),
    mockNumberPoolFindUnique: vi.fn(),
    mockUserFindFirst: vi.fn(),
    mockUserFindUnique: vi.fn(),
    mockCallCreate: vi.fn(),
    mockCallFindFirst: vi.fn(),
    mockPushSubscriptionFindMany: vi.fn(),
    mockFindLeadByPhone: vi.fn(),
    mockValidateTwilioRequest: vi.fn(),
    mockSendPushNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
    const proxy: any = {
        twilioLog: { create: mockTwilioLogCreate, update: mockTwilioLogUpdate },
        lead: { findUnique: mockLeadFindUnique, create: mockLeadCreate },
        numberPool: { findUnique: mockNumberPoolFindUnique },
        user: { findFirst: mockUserFindFirst, findUnique: mockUserFindUnique },
        call: { create: mockCallCreate, findFirst: mockCallFindFirst, update: vi.fn() },
        pushSubscription: { findMany: mockPushSubscriptionFindMany, delete: vi.fn() },
    };
    return {
        prismaDirect: proxy,
        prisma: proxy,
        withPrismaRetry: async <T,>(fn: () => Promise<T>) => fn(),
    };
});

vi.mock("@/lib/leads", () => ({
    findLeadByPhone: mockFindLeadByPhone,
}));

vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilioRequest,
    normalizeToE164: (s: string) => s, // pass-through; phone normalization tested elsewhere
}));

vi.mock("@/lib/push", () => ({
    sendPushNotification: mockSendPushNotification,
}));

// ---- Imports under test --------------------------------------------------
import { POST } from "@/app/api/twilio/inbound/route";

// ---- Helpers -------------------------------------------------------------
function fakeWebhookRequest(form: Record<string, string>): Request {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(k, v);
    return new Request("https://app.example.com/api/twilio/inbound", {
        method: "POST",
        body: fd,
    });
}

const OWNER_ID = "user-owner-uuid-1234";
const FALLBACK_ADMIN_ID = "user-admin-uuid-9999";

beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilioRequest.mockResolvedValue(true);
    mockTwilioLogCreate.mockResolvedValue({ id: "log-1" });
    mockTwilioLogUpdate.mockResolvedValue({});
    mockCallCreate.mockResolvedValue({ id: "call-1" });
    mockCallFindFirst.mockResolvedValue(null);
    mockPushSubscriptionFindMany.mockResolvedValue([]);
    mockUserFindFirst.mockResolvedValue({ id: FALLBACK_ADMIN_ID });
    mockUserFindUnique.mockResolvedValue(null);
    mockSendPushNotification.mockResolvedValue({ expired: false });
});

async function callRoute(form: Record<string, string>) {
    const res = await POST(fakeWebhookRequest(form));
    const body = await res.text();
    return { status: res.status, body, contentType: res.headers.get("content-type") };
}

// ---- Tests ---------------------------------------------------------------
describe("POST /api/twilio/inbound — TwiML structure (Workstream G)", () => {
    const FORM = {
        Caller: "+15551234567",
        To: "+15559999999",
        CallSid: "CA-test-call-sid-abc123",
    };

    it("targets <Client>{owner.id}</Client> when owner is online (fresh lastSeenAt)", async () => {
        mockFindLeadByPhone.mockResolvedValue({
            id: "lead-1", firstName: "Jane", lastName: "Doe", companyName: "Acme",
        });
        mockNumberPoolFindUnique.mockResolvedValue({
            phoneNumber: FORM.To,
            ownerUserId: OWNER_ID,
            owner: {
                id: OWNER_ID,
                email: "owner@test.com",
                lastSeenAt: new Date(), // online — just now
                repPhoneNumber: null,
            },
        });

        const { status, body, contentType } = await callRoute(FORM);

        expect(status).toBe(200);
        expect(contentType).toContain("text/xml");
        expect(body).toMatch(new RegExp(`<Client>${OWNER_ID}(?:<|</)`));
        // Caller-name parameters must be wired so the browser overlay can read them
        expect(body).toMatch(/<Parameter[^/]*name="callerName"[^/]*value="Jane Doe"/);
    });

    it("still targets <Client>{owner.id}</Client> when lastSeenAt is 89s old (heartbeat skew)", async () => {
        // Previous threshold was 60s — owner would have been classified offline
        // and the route would have fallen through to PSTN/hangup. The widened
        // 120s threshold must keep them online.
        mockFindLeadByPhone.mockResolvedValue({
            id: "lead-1", firstName: "Jane", lastName: "Doe", companyName: "Acme",
        });
        mockNumberPoolFindUnique.mockResolvedValue({
            phoneNumber: FORM.To,
            ownerUserId: OWNER_ID,
            owner: {
                id: OWNER_ID,
                email: "owner@test.com",
                lastSeenAt: new Date(Date.now() - 89_000), // worst-case skew
                repPhoneNumber: null,
            },
        });

        const { body } = await callRoute(FORM);
        expect(body).toMatch(new RegExp(`<Client>${OWNER_ID}(?:<|</)`));
        expect(body).not.toContain("Sorry, no agents are available");
    });

    it("falls back to ADMIN <Client> when To number is unmapped and no online agents exist", async () => {
        mockFindLeadByPhone.mockResolvedValue({
            id: "lead-1", firstName: "Jane", lastName: "Doe", companyName: "",
        });
        mockNumberPoolFindUnique.mockResolvedValue(null); // unknown DID
        mockUserFindFirst
            .mockResolvedValueOnce(null) // ANY_ONLINE fallback: no online agents
            .mockResolvedValueOnce({ id: FALLBACK_ADMIN_ID }); // ADMIN fallback

        const { body } = await callRoute(FORM);
        expect(body).toMatch(new RegExp(`<Client>${FALLBACK_ADMIN_ID}(?:<|</)`));
        expect(body).not.toContain(OWNER_ID);
    });

    it("includes simring <Number> when owner has repPhoneNumber set", async () => {
        mockFindLeadByPhone.mockResolvedValue({
            id: "lead-1", firstName: "Jane", lastName: "Doe", companyName: "Acme",
        });
        mockNumberPoolFindUnique.mockResolvedValue({
            phoneNumber: FORM.To,
            ownerUserId: OWNER_ID,
            owner: {
                id: OWNER_ID,
                email: "owner@test.com",
                lastSeenAt: new Date(),
                repPhoneNumber: "+15557777777",
            },
        });

        const { body } = await callRoute(FORM);
        expect(body).toMatch(new RegExp(`<Client>${OWNER_ID}(?:<|</)`));
        expect(body).toContain("+15557777777");
        expect(body).toMatch(/<Number[^>]*url=/);
    });

    it("rejects with 401 when Twilio signature is invalid in production", async () => {
        const prevEnv = process.env.NODE_ENV;
        // @ts-expect-error -- override for test
        process.env.NODE_ENV = "production";
        mockValidateTwilioRequest.mockResolvedValue(false);

        try {
            const { status } = await callRoute(FORM);
            expect(status).toBe(401);
        } finally {
            // @ts-expect-error -- restore
            process.env.NODE_ENV = prevEnv;
        }
    });
});
