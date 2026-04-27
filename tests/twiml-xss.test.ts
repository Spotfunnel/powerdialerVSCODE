import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/admin/twilio/spam-test-twiml — XML escaping of `?from=`
 * and Twilio signature validation.
 *
 * Two bugs:
 *  1. The route interpolates the user-supplied `from` query param directly
 *     into a TwiML <Say> string. Without XML escaping, an attacker can inject
 *     arbitrary TwiML verbs (e.g., `</Say><Redirect>https://evil/...`).
 *  2. The route was world-readable. Although fetched by Twilio (not the admin
 *     browser, so admin auth doesn't apply), it must still validate the Twilio
 *     signature so only real Twilio invocations succeed.
 */

const { mockValidateTwilio } = vi.hoisted(() => ({
    mockValidateTwilio: vi.fn(),
}));

vi.mock("@/lib/twilio", () => ({
    validateTwilioRequest: mockValidateTwilio,
}));

import { GET } from "@/app/api/admin/twilio/spam-test-twiml/route";

function getWith(from: string | null, headers: Record<string, string> = {}): Promise<Response> {
    const url = from === null
        ? "https://app.test/api/admin/twilio/spam-test-twiml"
        : `https://app.test/api/admin/twilio/spam-test-twiml?from=${encodeURIComponent(from)}`;
    return Promise.resolve(GET(new Request(url, { method: "GET", headers })));
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: signature is valid for the XSS-escape tests below.
    // Auth tests override this explicitly.
    mockValidateTwilio.mockResolvedValue(true);
});

describe("GET /api/admin/twilio/spam-test-twiml — Twilio signature", () => {
    it("returns 401 when X-Twilio-Signature is missing/invalid", async () => {
        mockValidateTwilio.mockResolvedValue(false);

        const res = await getWith("+61400000000");

        expect(res.status).toBe(401);
        const body = await res.text();
        // No TwiML leaked
        expect(body).not.toContain("<Response>");
        expect(body).not.toContain("<Say");
    });

    it("returns TwiML when signature is valid", async () => {
        mockValidateTwilio.mockResolvedValue(true);

        const res = await getWith("+61400000000", { "x-twilio-signature": "valid" });

        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("<Response>");
    });
});

describe("GET /api/admin/twilio/spam-test-twiml — XML escaping", () => {
    it("escapes < and > to prevent injection of TwiML verbs", async () => {
        const res = await getWith('</Say><Redirect>https://evil.test/twiml.xml</Redirect><Say>');
        const body = await res.text();

        // The raw injection string MUST NOT appear in the response
        expect(body).not.toContain("</Say><Redirect>");
        expect(body).not.toContain("<Redirect>https://evil.test");

        // Escaped form MUST appear — `<` becomes `&lt;`, `>` becomes `&gt;`
        expect(body).toContain("&lt;");
        expect(body).toContain("&gt;");

        // Outer TwiML structure remains valid
        expect(body).toMatch(/^<\?xml/);
        expect(body).toMatch(/<Say [^>]*>[\s\S]*<\/Say>/);
        expect(body).toMatch(/<Hangup\/>/);
    });

    it("escapes & to prevent entity-based attacks", async () => {
        const res = await getWith('A&B');
        const body = await res.text();

        // Raw `&` (without entity) must not appear inside the user content;
        // it must be escaped to `&amp;`
        expect(body).toContain("A&amp;B");
        expect(body).not.toMatch(/Test call from A&B\./);
    });

    it("escapes double quotes inside the user content", async () => {
        const res = await getWith('A"B');
        const body = await res.text();

        // The injected `"` must be escaped to `&quot;`
        expect(body).toContain("A&quot;B");
        // And must NOT appear unescaped inside the <Say> body
        expect(body).not.toMatch(/Test call from A"B\./);
    });

    it("preserves a normal phone number unchanged", async () => {
        const res = await getWith('+61400000000');
        const body = await res.text();

        expect(body).toContain("+61400000000");
        expect(body).toContain("This is a spam check.");
    });

    it("uses default text when from is missing", async () => {
        const res = await getWith(null);
        const body = await res.text();

        expect(body).toContain("unknown number");
    });

    it("escapes single quotes (covers attribute-context attacks)", async () => {
        const res = await getWith("A'B", { "x-twilio-signature": "valid" });
        const body = await res.text();

        // The single-quote replacement in escapeXml is `&apos;`
        expect(body).toContain("A&apos;B");
        // Raw `A'B` must not appear inside the <Say> body
        expect(body).not.toMatch(/Test call from A'B\./);
    });

    it("does not double-decode pre-encoded numeric character references", async () => {
        // Attacker pre-encodes `<Redirect>` as numeric refs to try to bypass
        // the literal `<` escape. The route must NOT decode these.
        const res = await getWith("&#x3C;Redirect&#x3E;", { "x-twilio-signature": "valid" });
        const body = await res.text();

        // The original `&` should be escaped to `&amp;`, producing
        // `&amp;#x3C;Redirect&amp;#x3E;` — no actual `<Redirect>` should
        // ever appear in the response.
        expect(body).not.toContain("<Redirect>");
        expect(body).toContain("&amp;");
    });

    it("escapes a CDATA-close sequence to prevent breakout from future CDATA wrappers", async () => {
        // Forward-coverage: if anyone wraps user content in <![CDATA[...]]>
        // later, an attacker-supplied `]]>` would close the section and
        // break out. Escaping `>` neutralises this regardless of context.
        const res = await getWith("foo]]>bar", { "x-twilio-signature": "valid" });
        const body = await res.text();

        expect(body).not.toContain("]]>");
        expect(body).toContain("&gt;");
    });
});
