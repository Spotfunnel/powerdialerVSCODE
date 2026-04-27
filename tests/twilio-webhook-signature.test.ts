import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for Twilio webhook signature validation on the two highest-risk
 * webhook routes: /api/twilio/recording and /api/twilio/sms/status.
 *
 * Both routes write to the DB based on Twilio-supplied params (callSid,
 * messageSid). Without signature validation, anyone who knows the route URLs
 * can:
 *   - mark arbitrary calls as `status='voicemail'`, `outcome='Left Voicemail'`
 *   - flip arbitrary message statuses (DELIVERED, FAILED, etc.)
 *
 * The fix:
 *   1. Each route validates `X-Twilio-Signature` via `validateTwilioRequest`
 *      from `@/lib/twilio`, in ALL environments (no NODE_ENV gate).
 *   2. Invalid/missing signatures return 401 BEFORE any DB write.
 *
 * These tests pin both invariants.
 */

// ---- Hoisted mocks -------------------------------------------------------
const {
    mockValidateTwilio,
    mockCallFindUnique,
    mockCallUpdate,
    mockMessageUpdate,
    mockNumberPoolFindUnique,
    mockFindLeadByPhone,
    mockLeadActivityCreate,
} = vi.hoisted(() => ({
    mockValidateTwilio: vi.fn(),
    mockCallFindUnique: vi.fn(),
    mockCallUpdate: vi.fn(),
    mockMessageUpdate: vi.fn(),
    mockNumberPoolFindUnique: vi.fn(),
    mockFindLeadByPhone: vi.fn(),
    mockLeadActivityCreate: vi.fn(),
}));

vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilio,
}));

vi.mock("@/lib/prisma", () => {
    const proxy: any = {
        call: { findUnique: mockCallFindUnique, update: mockCallUpdate },
        message: { update: mockMessageUpdate },
        numberPool: { findUnique: mockNumberPoolFindUnique },
        leadActivity: { create: mockLeadActivityCreate },
    };
    return {
        prisma: proxy,
        prismaDirect: proxy,
        withPrismaRetry: async <T,>(fn: () => Promise<T>) => fn(),
    };
});

vi.mock("@/lib/leads", () => ({
    findLeadByPhone: mockFindLeadByPhone,
}));

// `sms/inbound/route` imports `@/lib/push`, which calls `webpush.setVapidDetails`
// at module load. Mock it so tests don't require VAPID env vars.
vi.mock("@/lib/push", () => ({
    sendPushNotification: vi.fn(),
}));

// ---- Imports under test --------------------------------------------------
import { POST as recordingPOST } from "@/app/api/twilio/recording/route";
import { POST as smsStatusPOST } from "@/app/api/twilio/sms/status/route";
import { POST as statusPOST } from "@/app/api/twilio/status/route";
import { POST as smsInboundPOST } from "@/app/api/twilio/sms/inbound/route";

// ---- Helpers -------------------------------------------------------------
function recordingForm(): FormData {
    const fd = new FormData();
    fd.set("CallSid", "CA123");
    fd.set("RecordingUrl", "https://api.twilio.com/recordings/RE1");
    fd.set("RecordingSid", "RE1");
    return fd;
}

function smsStatusForm(): FormData {
    const fd = new FormData();
    fd.set("MessageSid", "SM123");
    fd.set("MessageStatus", "delivered");
    return fd;
}

function postWithHeaders(
    url: string,
    body: FormData,
    headers: Record<string, string> = {},
): Request {
    return new Request(url, { method: "POST", headers, body });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockCallFindUnique.mockResolvedValue({ id: "call-1", twilioSid: "CA123" });
    mockCallUpdate.mockResolvedValue({});
    mockMessageUpdate.mockResolvedValue({});
    mockNumberPoolFindUnique.mockResolvedValue(null);
    mockFindLeadByPhone.mockResolvedValue(null);
    mockLeadActivityCreate.mockResolvedValue({});
});

// ---- Tests: /api/twilio/recording ---------------------------------------
describe("POST /api/twilio/recording — signature validation", () => {
    it("returns 401 and skips DB writes when no X-Twilio-Signature header is present", async () => {
        // No header → validateTwilioRequest returns false (real impl already does this)
        mockValidateTwilio.mockResolvedValue(false);

        const res = await recordingPOST(
            postWithHeaders("https://app.test/api/twilio/recording", recordingForm()),
        );

        expect(res.status).toBe(401);
        expect(mockCallFindUnique).not.toHaveBeenCalled();
        expect(mockCallUpdate).not.toHaveBeenCalled();
    });

    it("returns 401 and skips DB writes when the signature is invalid", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await recordingPOST(
            postWithHeaders(
                "https://app.test/api/twilio/recording",
                recordingForm(),
                { "x-twilio-signature": "bogus-signature" },
            ),
        );

        expect(res.status).toBe(401);
        expect(mockCallUpdate).not.toHaveBeenCalled();
    });

    it("processes the request and writes to DB when signature is valid", async () => {
        mockValidateTwilio.mockResolvedValue(true);

        const res = await recordingPOST(
            postWithHeaders(
                "https://app.test/api/twilio/recording",
                recordingForm(),
                { "x-twilio-signature": "valid-signature" },
            ),
        );

        expect(res.status).toBe(200);
        expect(mockCallFindUnique).toHaveBeenCalledTimes(1);
        expect(mockCallUpdate).toHaveBeenCalledTimes(1);
        expect(mockCallUpdate.mock.calls[0][0].data).toMatchObject({
            recordingUrl: "https://api.twilio.com/recordings/RE1",
            status: "voicemail",
            outcome: "Left Voicemail",
        });
    });
});

// ---- Tests: /api/twilio/sms/status --------------------------------------
describe("POST /api/twilio/sms/status — signature validation", () => {
    it("returns 401 and skips DB writes when no X-Twilio-Signature header is present", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await smsStatusPOST(
            postWithHeaders("https://app.test/api/twilio/sms/status", smsStatusForm()),
        );

        expect(res.status).toBe(401);
        expect(mockMessageUpdate).not.toHaveBeenCalled();
    });

    it("returns 401 and skips DB writes when the signature is invalid", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await smsStatusPOST(
            postWithHeaders(
                "https://app.test/api/twilio/sms/status",
                smsStatusForm(),
                { "x-twilio-signature": "bogus-signature" },
            ),
        );

        expect(res.status).toBe(401);
        expect(mockMessageUpdate).not.toHaveBeenCalled();
    });

    it("processes the request and writes to DB when signature is valid", async () => {
        mockValidateTwilio.mockResolvedValue(true);

        const res = await smsStatusPOST(
            postWithHeaders(
                "https://app.test/api/twilio/sms/status",
                smsStatusForm(),
                { "x-twilio-signature": "valid-signature" },
            ),
        );

        expect(res.status).toBe(200);
        expect(mockMessageUpdate).toHaveBeenCalledTimes(1);
        expect(mockMessageUpdate.mock.calls[0][0]).toMatchObject({
            where: { twilioMessageSid: "SM123" },
            data: expect.objectContaining({ status: "DELIVERED" }),
        });
    });
});

// ---- Tests: NODE_ENV gate removal --------------------------------------
// These three routes had `if (process.env.NODE_ENV === "production")` gating
// their signature validation, leaving Vercel preview deployments fully open
// to webhook spoofing. After Fix G's "remove the gate" pass, validation must
// run in EVERY environment.
describe("POST /api/twilio/status — validates signature in non-production env", () => {
    it("returns 401 when signature is invalid (no NODE_ENV setup)", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const fd = new FormData();
        fd.set("CallSid", "CA123");
        fd.set("CallStatus", "completed");

        const res = await statusPOST(
            new Request("https://app.test/api/twilio/status", {
                method: "POST",
                body: fd,
            }),
        );

        expect(res.status).toBe(401);
        expect(mockCallFindUnique).not.toHaveBeenCalled();
        expect(mockCallUpdate).not.toHaveBeenCalled();
    });
});

describe("POST /api/twilio/sms/inbound — validates signature in non-production env", () => {
    it("returns 401 when signature is invalid (no NODE_ENV setup)", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const fd = new FormData();
        fd.set("From", "+15551234567");
        fd.set("To", "+61412000001");
        fd.set("Body", "test message");
        fd.set("MessageSid", "SM999");

        const res = await smsInboundPOST(
            new Request("https://app.test/api/twilio/sms/inbound", {
                method: "POST",
                body: fd,
            }),
        );

        expect(res.status).toBe(401);
        expect(mockNumberPoolFindUnique).not.toHaveBeenCalled();
        expect(mockFindLeadByPhone).not.toHaveBeenCalled();
    });
});
