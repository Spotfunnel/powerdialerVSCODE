import { describe, it, expect } from "vitest";
import {
    fallbackCompanyName,
    displayCompanyName,
    LEGACY_COMPANY_SENTINELS,
} from "@/lib/lead-display";

// ---------------------------------------------------------------------------
// fallbackCompanyName — defensive only; CSVs always supply a company name in
// practice. Returns the phone number, never a sentinel and never a name.
// ---------------------------------------------------------------------------

describe("fallbackCompanyName", () => {
    it("returns the phone number", () => {
        expect(fallbackCompanyName({ phoneNumber: "+61412345678" })).toBe("+61412345678");
    });

    it("never returns a legacy sentinel string", () => {
        const out = fallbackCompanyName({ phoneNumber: "+15551234567" });
        for (const s of LEGACY_COMPANY_SENTINELS) {
            expect(out).not.toBe(s);
        }
    });
});

// ---------------------------------------------------------------------------
// displayCompanyName — strips legacy sentinels at render time, falls back
// to phone (never to a name field).
// ---------------------------------------------------------------------------

describe("displayCompanyName", () => {
    it("returns the real companyName when present and not a sentinel", () => {
        expect(displayCompanyName({
            companyName: "Acme Corp", phoneNumber: "+1",
        })).toBe("Acme Corp");
    });

    it("strips 'Unknown Company' and falls back to phone", () => {
        expect(displayCompanyName({
            companyName: "Unknown Company", phoneNumber: "+61412345678",
        })).toBe("+61412345678");
    });

    it("strips 'Unknown Caller' and falls back to phone", () => {
        expect(displayCompanyName({
            companyName: "Unknown Caller", phoneNumber: "+61412345678",
        })).toBe("+61412345678");
    });

    it("strips 'Unknown Business' and 'Unknown' literals too", () => {
        expect(displayCompanyName({
            companyName: "Unknown Business", phoneNumber: "+1234",
        })).toBe("+1234");
        expect(displayCompanyName({
            companyName: "Unknown", phoneNumber: "+1234",
        })).toBe("+1234");
    });

    it("trims whitespace before sentinel matching", () => {
        expect(displayCompanyName({
            companyName: "   Unknown Company   ", phoneNumber: "+1234",
        })).toBe("+1234");
    });

    it("returns the configured dash when sentinel and no phone available", () => {
        expect(displayCompanyName({ companyName: "Unknown Company", phoneNumber: null })).toBe("—");
        expect(displayCompanyName({ companyName: "", phoneNumber: undefined }, "—")).toBe("—");
    });

    it("uses a custom dash when supplied", () => {
        expect(displayCompanyName({ companyName: null }, "(no company)")).toBe("(no company)");
    });

    it("never renders any legacy sentinel literal", () => {
        for (const s of LEGACY_COMPANY_SENTINELS) {
            const out = displayCompanyName({
                companyName: s, phoneNumber: "+15551234567",
            });
            for (const t of LEGACY_COMPANY_SENTINELS) {
                expect(out).not.toBe(t);
            }
        }
    });

    it("does NOT use first/last name fields even if present (companyName only or phone)", () => {
        // Pass extra fields to confirm they're ignored — type doesn't allow them but
        // the runtime should still degrade safely.
        const out = displayCompanyName({
            companyName: "Unknown Company",
            phoneNumber: "+15551234567",
            // @ts-expect-error — first/last must NOT influence company display
            firstName: "Jane", lastName: "Doe",
        });
        expect(out).toBe("+15551234567");
        expect(out).not.toBe("Jane Doe");
    });
});
