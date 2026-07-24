import { describe, it, expect } from "vitest";
import { normalizeToE164, isAustralianLandline } from "@/lib/phone-utils";

describe("normalizeToE164 - AU mobile formats", () => {
    it("0412345678 -> +61412345678", () => {
        expect(normalizeToE164("0412345678")).toBe("+61412345678");
    });
    it("412345678 (no leading 0) -> +61412345678", () => {
        expect(normalizeToE164("412345678")).toBe("+61412345678");
    });
    it("+61412345678 (already E.164) stays", () => {
        expect(normalizeToE164("+61412345678")).toBe("+61412345678");
    });
    it("strips spaces from formatted AU mobile", () => {
        expect(normalizeToE164("0412 345 678")).toBe("+61412345678");
    });
    it("strips parens/dashes from AU mobile", () => {
        expect(normalizeToE164("(04) 1234-5678")).toBe("+61412345678");
    });
    it("doubled +61 country code is collapsed", () => {
        expect(normalizeToE164("+61+61412345678")).toBe("+61412345678");
    });
});

describe("normalizeToE164 - AU landline formats", () => {
    it("0298765432 (Sydney landline) -> +61298765432", () => {
        expect(normalizeToE164("0298765432")).toBe("+61298765432");
    });
    it("612 prefix (1800 number) is preserved", () => {
        expect(normalizeToE164("611800951077")).toBe("+611800951077");
    });
    it("doubled +61 on 1800 is collapsed", () => {
        expect(normalizeToE164("+61+611800951077")).toBe("+611800951077");
    });
});

describe("normalizeToE164 - AU 1300/1800/13 shared-cost numbers", () => {
    // Regression: previously these fell through to the catch-all and produced
    // "+1300..." (US country code), which Twilio rejects with error 13224
    // ("invalid phone number"). Every outbound call to a 1300/1800 lead failed.
    it("1300668366 -> +611300668366 (NOT +1300668366)", () => {
        expect(normalizeToE164("1300668366")).toBe("+611300668366");
        expect(normalizeToE164("1300668366")).not.toBe("+1300668366");
    });
    it("1800032415 -> +611800032415 (NOT +1800032415)", () => {
        expect(normalizeToE164("1800032415")).toBe("+611800032415");
        expect(normalizeToE164("1800032415")).not.toBe("+1800032415");
    });
    it("formatted '1300 724 005' -> +611300724005", () => {
        expect(normalizeToE164("1300 724 005")).toBe("+611300724005");
    });
    it("formatted '1800-865-005' -> +611800865005", () => {
        expect(normalizeToE164("1800-865-005")).toBe("+611800865005");
    });
    it("AU 13xxxx 6-digit shortcode -> +6113xxxx", () => {
        expect(normalizeToE164("131456")).toBe("+61131456");
    });
    it("already-correct +611300668366 stays as-is", () => {
        expect(normalizeToE164("+611300668366")).toBe("+611300668366");
    });
    it("already-correct +611800032415 stays as-is", () => {
        expect(normalizeToE164("+611800032415")).toBe("+611800032415");
    });
    it("legacy malformed '+1300668366' is repaired to +611300668366", () => {
        // Defensive: if a previously-broken value gets re-normalised, fix it.
        expect(normalizeToE164("+1300668366")).toBe("+611300668366");
    });
    it("legacy malformed '+1800032415' is repaired to +611800032415", () => {
        expect(normalizeToE164("+1800032415")).toBe("+611800032415");
    });
});

describe("normalizeToE164 - US numbers", () => {
    it("10-digit US number -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("8504390035")).toBe("+18504390035");
    });
    it("US with formatting -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("(850) 439-0035")).toBe("+18504390035");
    });
    it("US with 1 prefix -> +1XXXXXXXXXX", () => {
        expect(normalizeToE164("18504390035")).toBe("+18504390035");
    });
    it("US already E.164 stays", () => {
        expect(normalizeToE164("+18504390035")).toBe("+18504390035");
    });
    it("doubled US country code (+1+1...) collapses", () => {
        expect(normalizeToE164("+1+18504390035")).toBe("+18504390035");
    });
});

describe("normalizeToE164 - invalid / edge inputs", () => {
    it("empty string -> empty string", () => {
        expect(normalizeToE164("")).toBe("");
    });
    it("only spaces -> empty (no bare '+')", () => {
        expect(normalizeToE164("   ")).toBe("");
    });
    it("alphabet only -> empty (no bare '+')", () => {
        expect(normalizeToE164("not a number")).toBe("");
    });
    it("symbols only -> empty", () => {
        expect(normalizeToE164("@#$%")).toBe("");
    });
});

describe("isAustralianLandline", () => {
    it("Sydney landline (+612...) is landline", () => {
        expect(isAustralianLandline("+61298765432")).toBe(true);
    });
    it("Melbourne landline (+613...) is landline", () => {
        expect(isAustralianLandline("+61398765432")).toBe(true);
    });
    it("AU mobile (+614...) is NOT landline", () => {
        expect(isAustralianLandline("+61412345678")).toBe(false);
    });
    it("US number (+1...) is NOT AU landline", () => {
        expect(isAustralianLandline("+18504390035")).toBe(false);
    });
});
