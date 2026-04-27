import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/voice/twiml signature validation.
 *
 * This is the Voice URL webhook Twilio calls when the browser SDK initiates
 * an outbound call. Without signature validation, an attacker who knows the
 * URL can:
 *  - Inflate NumberPool.dailyCount via repeated `selectOutboundNumber` calls
 *    → prematurely cooldown numbers → DoS for real reps
 *  - Create bogus Call rows tied to enumerated userIds
 *  - Cause spurious DB load via Lead/Settings lookups
 *
 * Fix: validate `X-Twilio-Signature` before any of that work.
 */

// ---- Hoisted mocks -------------------------------------------------------
const {
    mockValidateTwilio,
    mockLeadFindFirst,
    mockSettingsFindUnique,
    mockCallCreate,
    mockSelectOutboundNumber,
} = vi.hoisted(() => ({
    mockValidateTwilio: vi.fn(),
    mockLeadFindFirst: vi.fn(),
    mockSettingsFindUnique: vi.fn(),
    mockCallCreate: vi.fn(),
    mockSelectOutboundNumber: vi.fn(),
}));

vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilio,
}));

vi.mock("@/lib/prisma", () => {
    const proxy: any = {
        lead: { findFirst: mockLeadFindFirst },
        settings: { findUnique: mockSettingsFindUnique },
        call: { create: mockCallCreate },
    };
    return { prisma: proxy, prismaDirect: proxy };
});

vi.mock("@/lib/number-rotation", () => ({
    selectOutboundNumber: mockSelectOutboundNumber,
}));

// ---- Imports under test --------------------------------------------------
import { POST } from "@/app/api/voice/twiml/route";

// ---- Helpers -------------------------------------------------------------
function voiceForm(): FormData {
    const fd = new FormData();
    fd.set("To", "+15551234567");
    fd.set("From", "client:user-abc");
    return fd;
}

function postWithHeaders(body: FormData, headers: Record<string, string> = {}): Request {
    return new Request("https://app.test/api/voice/twiml", {
        method: "POST",
        headers,
        body,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockLeadFindFirst.mockResolvedValue(null);
    mockSettingsFindUnique.mockResolvedValue({
        twilioFromNumbers: "+61400000000",
    });
    mockSelectOutboundNumber.mockResolvedValue({ phoneNumber: "+61412000001" });
    mockCallCreate.mockResolvedValue({ id: "call-1" });
});

describe("POST /api/voice/twiml — signature validation", () => {
    it("returns 401 and skips all side effects when X-Twilio-Signature is missing", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await POST(postWithHeaders(voiceForm()));

        expect(res.status).toBe(401);
        expect(mockSelectOutboundNumber).not.toHaveBeenCalled();
        expect(mockLeadFindFirst).not.toHaveBeenCalled();
        expect(mockSettingsFindUnique).not.toHaveBeenCalled();
        expect(mockCallCreate).not.toHaveBeenCalled();
    });

    it("returns 401 and skips all side effects when signature is invalid", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await POST(
            postWithHeaders(voiceForm(), { "x-twilio-signature": "bogus" }),
        );

        expect(res.status).toBe(401);
        expect(mockSelectOutboundNumber).not.toHaveBeenCalled();
        expect(mockCallCreate).not.toHaveBeenCalled();
    });

    it("returns TwiML response and runs full pipeline when signature is valid", async () => {
        mockValidateTwilio.mockResolvedValue(true);

        const res = await POST(
            postWithHeaders(voiceForm(), { "x-twilio-signature": "valid" }),
        );

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("text/xml");
        const body = await res.text();
        expect(body).toContain("<Dial");
        expect(body).toContain("+15551234567");
        // Side effects ran: rotation called for the dial caller-ID
        expect(mockSelectOutboundNumber).toHaveBeenCalledTimes(1);
    });
});
