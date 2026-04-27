import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/twilio/twiml/bridge GET handler.
 *
 * Two bugs being driven out:
 *
 *  1. **No signature validation** → toll-fraud vector. Anyone with a valid
 *     `leadId` query param can hit this route and cause Twilio to dial the
 *     lead's number on the company's account. Forged GETs from outside Twilio
 *     must be rejected.
 *
 *  2. **Unescaped DB-sourced data interpolated into raw TwiML** at lines 64
 *     (`callerId`) and 71 (`lead.phoneNumber`). If attacker-controlled data
 *     ever lands in either field (e.g., via CSV import accepting unsanitised
 *     phone strings), it is reflected as TwiML — opening verb-injection.
 */

// ---- Hoisted mocks -------------------------------------------------------
const {
    mockValidateTwilio,
    mockLeadFindUnique,
    mockSettingsFindUnique,
    mockCallUpdateMany,
    mockSelectOutboundNumber,
} = vi.hoisted(() => ({
    mockValidateTwilio: vi.fn(),
    mockLeadFindUnique: vi.fn(),
    mockSettingsFindUnique: vi.fn(),
    mockCallUpdateMany: vi.fn(),
    mockSelectOutboundNumber: vi.fn(),
}));

vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilio,
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        lead: { findUnique: mockLeadFindUnique },
        settings: { findUnique: mockSettingsFindUnique },
        call: { updateMany: mockCallUpdateMany },
    },
}));

vi.mock("@/lib/number-rotation", () => ({
    selectOutboundNumber: mockSelectOutboundNumber,
}));

import { GET } from "@/app/api/twilio/twiml/bridge/route";

function bridgeRequest(query: string, headers: Record<string, string> = {}): Request {
    return new Request(`https://app.test/api/twilio/twiml/bridge?${query}`, {
        method: "GET",
        headers,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockLeadFindUnique.mockResolvedValue({
        id: "lead-1",
        phoneNumber: "+15555550100",
        assignedToId: "user-1",
        campaign: null,
    });
    mockSettingsFindUnique.mockResolvedValue({ twilioFromNumbers: "+61400000000" });
    mockSelectOutboundNumber.mockResolvedValue({ phoneNumber: "+61412000001" });
    mockCallUpdateMany.mockResolvedValue({ count: 0 });
});

describe("GET /api/twilio/twiml/bridge — signature validation", () => {
    it("returns 401 and skips DB lookups when X-Twilio-Signature is missing", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await GET(bridgeRequest("leadId=lead-1&userId=user-1"));

        expect(res.status).toBe(401);
        expect(mockLeadFindUnique).not.toHaveBeenCalled();
        expect(mockSelectOutboundNumber).not.toHaveBeenCalled();
    });

    it("returns 401 when signature is invalid", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await GET(
            bridgeRequest("leadId=lead-1", { "x-twilio-signature": "bogus" }),
        );

        expect(res.status).toBe(401);
        expect(mockLeadFindUnique).not.toHaveBeenCalled();
    });

    it("returns TwiML and runs full pipeline when signature is valid", async () => {
        mockValidateTwilio.mockResolvedValue(true);

        const res = await GET(
            bridgeRequest("leadId=lead-1&userId=user-1", { "x-twilio-signature": "valid" }),
        );

        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toMatch(/<Dial[^>]*callerId="\+61412000001"/);
        expect(body).toContain("<Number>+15555550100</Number>");
        expect(mockLeadFindUnique).toHaveBeenCalledTimes(1);
        expect(mockSelectOutboundNumber).toHaveBeenCalledTimes(1);
    });
});

describe("GET /api/twilio/twiml/bridge — XML escaping of DB data", () => {
    it("escapes special chars in lead.phoneNumber when interpolating into <Number>", async () => {
        mockValidateTwilio.mockResolvedValue(true);
        // Simulate dirty data landing in DB (e.g. via lax CSV import)
        mockLeadFindUnique.mockResolvedValue({
            id: "lead-x",
            phoneNumber: "+1555</Number><Redirect>https://evil.test</Redirect><Number>",
            assignedToId: "user-1",
            campaign: null,
        });

        const res = await GET(
            bridgeRequest("leadId=lead-x", { "x-twilio-signature": "valid" }),
        );
        const body = await res.text();

        // Raw injection MUST NOT appear
        expect(body).not.toContain("</Number><Redirect>");
        expect(body).not.toContain("<Redirect>https://evil.test");
        // Escaped form MUST appear
        expect(body).toContain("&lt;");
        expect(body).toContain("&gt;");
    });

    it("escapes special chars in callerId when interpolating into the Dial attribute", async () => {
        mockValidateTwilio.mockResolvedValue(true);
        // Number rotation returns a tainted number
        mockSelectOutboundNumber.mockResolvedValue({
            phoneNumber: '+1555" malicious="yes',
        });

        const res = await GET(
            bridgeRequest("leadId=lead-1", { "x-twilio-signature": "valid" }),
        );
        const body = await res.text();

        // The injected `"` must be escaped — must NOT see a stray closing quote
        // followed by an injected attribute
        expect(body).not.toContain('" malicious="yes"');
        expect(body).toContain("&quot;");
    });
});
