import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/voice/twiml — pins the AU 1300/1800 dial contract.
 *
 * Regression: leads imported with phone "1300 668 366" had their phoneNumber
 * stored as "+1300668366" (US country code) due to a hole in normalizeToE164.
 * When the rep clicked dial, Twilio received <Dial><Number>+1300668366</Number></Dial>
 * and rejected the call with error 13224 ("invalid phone number").
 *
 * The contract this test pins:
 *   1. /api/voice/twiml MUST emit <Dial><Number> with the correct AU E.164
 *      form +61130066836... regardless of whether the incoming "To" param
 *      is the new correct form, the legacy broken form, or unprefixed.
 *   2. <Dial><Client targets="..."> for client-prefixed targets is unchanged.
 */

const {
    mockValidateTwilio,
    mockLeadFindFirst,
    mockSettingsFindUnique,
    mockSelectOutboundNumber,
    mockCallCreate,
} = vi.hoisted(() => ({
    mockValidateTwilio: vi.fn(),
    mockLeadFindFirst: vi.fn(),
    mockSettingsFindUnique: vi.fn(),
    mockSelectOutboundNumber: vi.fn(),
    mockCallCreate: vi.fn(),
}));

vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilio,
}));

vi.mock("@/lib/prisma", () => {
    const proxy: any = {
        lead: { findFirst: mockLeadFindFirst, create: vi.fn() },
        settings: { findUnique: mockSettingsFindUnique },
        call: { create: mockCallCreate },
    };
    return {
        prisma: proxy,
        prismaDirect: proxy,
        withPrismaRetry: async <T,>(fn: () => Promise<T>) => fn(),
    };
});

vi.mock("@/lib/number-rotation", () => ({
    selectOutboundNumber: mockSelectOutboundNumber,
}));

import { POST } from "@/app/api/voice/twiml/route";

function fakeRequest(form: Record<string, string>): Request {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(k, v);
    return new Request("https://www.getspotfunnel.com/api/voice/twiml", {
        method: "POST",
        body: fd,
        headers: { "x-twilio-signature": "valid" },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilio.mockResolvedValue(true);
    mockLeadFindFirst.mockResolvedValue(null);
    mockSettingsFindUnique.mockResolvedValue({
        twilioFromNumbers: "+61485037733,+61485028377",
    });
    mockSelectOutboundNumber.mockResolvedValue({ phoneNumber: "+61485037733" });
    mockCallCreate.mockResolvedValue({ id: "call-1" });
});

describe("POST /api/voice/twiml — AU 1300/1800 shared-cost dial contract", () => {
    it("repairs legacy +1300xxxxxxxxx to +611300xxxxxxxxx in <Dial><Number>", async () => {
        // Simulate a stale browser sending the historically-broken form.
        const res = await POST(fakeRequest({
            To: "+1300668366",
            From: "client:user-1",
        }));
        const xml = await res.text();
        expect(xml).toContain("<Number>+611300668366</Number>");
        expect(xml).not.toContain("<Number>+1300668366</Number>");
    });

    it("repairs legacy +1800xxxxxxxxx to +611800xxxxxxxxx in <Dial><Number>", async () => {
        const res = await POST(fakeRequest({
            To: "+1800032415",
            From: "client:user-1",
        }));
        const xml = await res.text();
        expect(xml).toContain("<Number>+611800032415</Number>");
        expect(xml).not.toContain("<Number>+1800032415</Number>");
    });

    it("dials correct +611300xxx unchanged", async () => {
        const res = await POST(fakeRequest({
            To: "+611300668366",
            From: "client:user-1",
        }));
        const xml = await res.text();
        expect(xml).toContain("<Number>+611300668366</Number>");
    });

    it("dials standard AU mobile +614... unchanged", async () => {
        const res = await POST(fakeRequest({
            To: "+61412345678",
            From: "client:user-1",
        }));
        const xml = await res.text();
        expect(xml).toContain("<Number>+61412345678</Number>");
        // Must NOT use answerOnBridge: AU carriers often send no early ringback,
        // so the rep would hear silence and think the call failed (dur=0, no error).
        expect(xml).not.toContain("answerOnBridge");
    });

    it("dials standard US +1 unchanged", async () => {
        const res = await POST(fakeRequest({
            To: "+18504390035",
            From: "client:user-1",
        }));
        const xml = await res.text();
        expect(xml).toContain("<Number>+18504390035</Number>");
    });

    it("client: prefix is left intact (Client target, not <Number>)", async () => {
        const res = await POST(fakeRequest({
            To: "client:user-2",
            From: "client:user-1",
        }));
        const xml = await res.text();
        expect(xml).toContain("<Client>user-2</Client>");
        expect(xml).not.toMatch(/<Number>/);
    });
});

describe("POST /api/voice/twiml — empty caller-ID guard (B2)", () => {
    it("returns a spoken error, NOT an empty <Dial>, when no caller-ID is available", async () => {
        // Rotation returns null (pool exhausted / transient error) AND Settings
        // has no fallback from-number. Emitting <Dial callerId=""> would make
        // Twilio reject with 21213 and the rep hears dead air.
        mockSelectOutboundNumber.mockResolvedValue(null);
        mockSettingsFindUnique.mockResolvedValue({ twilioFromNumbers: null });

        const res = await POST(fakeRequest({ To: "+61412345678", From: "client:user-1" }));
        const xml = await res.text();

        expect(xml).not.toContain('callerId=""');
        expect(xml).not.toMatch(/<Number>/);
        expect(xml).toMatch(/<Say>/);
    });

    it("still dials when rotation is null but Settings has a fallback number", async () => {
        mockSelectOutboundNumber.mockResolvedValue(null);
        mockSettingsFindUnique.mockResolvedValue({ twilioFromNumbers: "+61468185435" });

        const res = await POST(fakeRequest({ To: "+61412345678", From: "client:user-1" }));
        const xml = await res.text();

        expect(xml).toContain('callerId="+61468185435"');
        expect(xml).toContain("<Number>+61412345678</Number>");
    });
});
