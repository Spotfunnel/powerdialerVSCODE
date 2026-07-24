import { describe, it, expect } from "vitest";
import { extractDispatch } from "@/lib/disposition-response";

/**
 * Regression (B1): LeadContext.updateLeadStatus did `const result = await
 * res.json()` and `return result?.dispatch || null` WITHOUT checking res.ok.
 * fetch() only rejects on network errors, so a 500 (atomic-tx failure, "Lead
 * not found", DB drop) resolved as success — the rep's disposition was
 * silently lost, and the BOOKED path showed a hardcoded "Confirmed" banner for
 * a meeting that was never written. extractDispatch() must THROW on !ok so the
 * existing handleDispositionFailure path fires.
 */

describe("extractDispatch", () => {
    it("throws when the response is not ok (500)", () => {
        expect(() => extractDispatch(false, 500, { error: "Lead not found" }))
            .toThrowError(/Lead not found/);
    });

    it("throws with status when body has no error message", () => {
        expect(() => extractDispatch(false, 503, {})).toThrowError(/503/);
    });

    it("returns the dispatch object on success", () => {
        const dispatch = { calendar: "sent", sms: "sent" };
        expect(extractDispatch(true, 200, { success: true, dispatch })).toEqual(dispatch);
    });

    it("returns null when ok but no dispatch present", () => {
        expect(extractDispatch(true, 200, { success: true })).toBeNull();
    });

    it("does not treat a 4xx as success", () => {
        expect(() => extractDispatch(false, 401, { error: "Unauthorized" })).toThrow();
    });
});
