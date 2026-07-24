import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/twilio/inbound — specifically the "Unknown Caller" regression
 * where unknown callers had their auto-created Lead permanently stamped with
 * companyName === "Unknown Caller" in the database.
 *
 * Contract: when an unknown caller dials in, the auto-created Lead's
 * companyName must be the caller's phone number, never the sentinel string.
 */

const {
    mockTwilioLogCreate, mockTwilioLogUpdate,
    mockLeadCreate,
    mockNumberPoolFindUnique,
    mockUserFindFirst, mockUserFindUnique,
    mockCallCreate, mockCallFindFirst,
    mockPushSubscriptionFindMany,
    mockFindLeadByPhone, mockValidateTwilioRequest,
    mockSendPushNotification,
} = vi.hoisted(() => ({
    mockTwilioLogCreate: vi.fn(),
    mockTwilioLogUpdate: vi.fn(),
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
        lead: { create: mockLeadCreate },
        numberPool: { findUnique: mockNumberPoolFindUnique },
        user: { findFirst: mockUserFindFirst, findUnique: mockUserFindUnique },
        call: { create: mockCallCreate, findFirst: mockCallFindFirst, update: vi.fn() },
        pushSubscription: { findMany: mockPushSubscriptionFindMany, delete: vi.fn() },
    };
    return {
        prismaDirect: proxy, prisma: proxy,
        withPrismaRetry: async <T,>(fn: () => Promise<T>) => fn(),
    };
});

vi.mock("@/lib/leads", () => ({ findLeadByPhone: mockFindLeadByPhone }));
vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilioRequest,
    normalizeToE164: (s: string) => s,
}));
vi.mock("@/lib/push", () => ({ sendPushNotification: mockSendPushNotification }));

import { POST } from "@/app/api/twilio/inbound/route";

function fakeWebhookRequest(form: Record<string, string>): Request {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(k, v);
    return new Request("https://app.example.com/api/twilio/inbound", {
        method: "POST", body: fd,
    });
}

const CALLER = "+15551234567";
const TO = "+15559999999";

beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilioRequest.mockResolvedValue(true);
    mockTwilioLogCreate.mockResolvedValue({ id: "log-1" });
    mockTwilioLogUpdate.mockResolvedValue({});
    mockCallCreate.mockResolvedValue({ id: "call-1" });
    mockCallFindFirst.mockResolvedValue(null);
    mockPushSubscriptionFindMany.mockResolvedValue([]);
    mockUserFindFirst.mockResolvedValue({ id: "admin-1" });
    mockUserFindUnique.mockResolvedValue(null);
    mockNumberPoolFindUnique.mockResolvedValue(null);
    mockSendPushNotification.mockResolvedValue({ expired: false });
});

describe("inbound webhook — auto-created Lead never gets 'Unknown Caller' sentinel", () => {
    it("creates Lead with companyName = phone number for unknown callers", async () => {
        mockFindLeadByPhone.mockResolvedValue(null); // unknown caller path
        mockLeadCreate.mockResolvedValue({
            id: "lead-1", firstName: "Inbound", lastName: "Caller",
            companyName: CALLER, phoneNumber: CALLER,
        });

        await POST(fakeWebhookRequest({
            Caller: CALLER, To: TO, CallSid: "CA-test-1",
        }));

        expect(mockLeadCreate).toHaveBeenCalledTimes(1);
        const arg = mockLeadCreate.mock.calls[0][0];
        expect(arg.data.companyName).not.toBe("Unknown Caller");
        expect(arg.data.companyName).not.toBe("Unknown Company");
        expect(arg.data.companyName).toBe(CALLER);
    });

    it("TwiML callerCompany param does not contain 'Unknown Company' for nameless leads", async () => {
        mockFindLeadByPhone.mockResolvedValue({
            id: "lead-1", firstName: "", lastName: "", companyName: "", phoneNumber: CALLER,
        });
        mockNumberPoolFindUnique.mockResolvedValue({
            phoneNumber: TO, ownerUserId: "u1",
            owner: { id: "u1", email: "x@x.com", lastSeenAt: new Date(), repPhoneNumber: null },
        });

        const res = await POST(fakeWebhookRequest({
            Caller: CALLER, To: TO, CallSid: "CA-test-2",
        }));
        const body = await res.text();

        expect(body).not.toContain("Unknown Company");
        expect(body).not.toContain("Unknown Caller");
    });
});
