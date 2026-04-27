import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for Twilio signature validation on the 4 remaining TwiML-only
 * webhook routes:
 *   /api/twilio/voicemail        — TwiML for voicemail recording prompt
 *   /api/twilio/whisper          — TwiML for inbound-call screening
 *   /api/twilio/inbound-status   — TwiML for inbound-dial fallback
 *   /api/twilio/vm-drop-twiml    — Static TwiML for voicemail drop
 *
 * These routes return TwiML and don't write to the DB, so impact is lower
 * than the call-state writers — but they still control what Twilio executes
 * mid-call (record, redirect, hangup). Spoofed requests can disrupt live
 * call flow. After fix: every route validates the X-Twilio-Signature.
 */

const { mockValidateTwilio, mockGetBaseUrl } = vi.hoisted(() => ({
    mockValidateTwilio: vi.fn(),
    mockGetBaseUrl: vi.fn(),
}));

vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilio,
    getBaseUrl: mockGetBaseUrl,
}));

import { POST as voicemailPOST } from "@/app/api/twilio/voicemail/route";
import { POST as whisperPOST } from "@/app/api/twilio/whisper/route";
import { POST as inboundStatusPOST } from "@/app/api/twilio/inbound-status/route";
import { POST as vmDropPOST } from "@/app/api/twilio/vm-drop-twiml/route";

function postWith(url: string, body: FormData, headers: Record<string, string> = {}): Request {
    return new Request(url, { method: "POST", headers, body });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetBaseUrl.mockResolvedValue("https://app.test");
});

describe("POST /api/twilio/voicemail — signature validation", () => {
    it("returns 401 with no signature", async () => {
        mockValidateTwilio.mockResolvedValue(false);
        const fd = new FormData();
        fd.set("CallSid", "CA1");
        const res = await voicemailPOST(postWith("https://app.test/api/twilio/voicemail", fd));
        expect(res.status).toBe(401);
    });

    it("returns TwiML with valid signature", async () => {
        mockValidateTwilio.mockResolvedValue(true);
        const fd = new FormData();
        fd.set("CallSid", "CA1");
        const res = await voicemailPOST(
            postWith("https://app.test/api/twilio/voicemail", fd, { "x-twilio-signature": "ok" }),
        );
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("<Record");
    });
});

describe("POST /api/twilio/whisper — signature validation", () => {
    it("returns 401 with no signature", async () => {
        mockValidateTwilio.mockResolvedValue(false);
        const res = await whisperPOST(postWith("https://app.test/api/twilio/whisper", new FormData()));
        expect(res.status).toBe(401);
    });

    it("returns TwiML with valid signature", async () => {
        mockValidateTwilio.mockResolvedValue(true);
        const fd = new FormData();
        const res = await whisperPOST(
            postWith("https://app.test/api/twilio/whisper", fd, { "x-twilio-signature": "ok" }),
        );
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toMatch(/<Gather|<Hangup/);
    });
});

describe("POST /api/twilio/inbound-status — signature validation", () => {
    it("returns 401 with no signature", async () => {
        mockValidateTwilio.mockResolvedValue(false);
        const fd = new FormData();
        fd.set("DialCallStatus", "completed");
        const res = await inboundStatusPOST(
            postWith("https://app.test/api/twilio/inbound-status", fd),
        );
        expect(res.status).toBe(401);
    });

    it("returns TwiML with valid signature", async () => {
        mockValidateTwilio.mockResolvedValue(true);
        const fd = new FormData();
        fd.set("DialCallStatus", "no-answer");
        const res = await inboundStatusPOST(
            postWith("https://app.test/api/twilio/inbound-status", fd, { "x-twilio-signature": "ok" }),
        );
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("<Response>");
    });
});

describe("POST /api/twilio/vm-drop-twiml — signature validation", () => {
    it("returns 401 with no signature", async () => {
        mockValidateTwilio.mockResolvedValue(false);
        const res = await vmDropPOST(
            postWith("https://app.test/api/twilio/vm-drop-twiml", new FormData()),
        );
        expect(res.status).toBe(401);
    });

    it("returns TwiML with valid signature", async () => {
        mockValidateTwilio.mockResolvedValue(true);
        const res = await vmDropPOST(
            postWith("https://app.test/api/twilio/vm-drop-twiml", new FormData(), {
                "x-twilio-signature": "ok",
            }),
        );
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("<Say");
    });
});
