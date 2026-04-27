import { describe, it, expect, vi } from "vitest";
import { handleDispositionFailure } from "@/lib/disposition-failure";

/**
 * Tests for handleDispositionFailure — pure helper extracted from
 * DispositionPanel.tsx's `handleDisposition` catch block.
 *
 * Bug being driven out: when `updateLeadStatus` rejected, the catch block
 * showed a toast but never reset `submittedStatus` to null. Disposition
 * buttons + notes textarea (which both check `submittedStatus`) became
 * permanently disabled — the user had to reload the page.
 *
 * Fix invariant: every failure path MUST clear the optimistic
 * `submittedStatus` so the form unlocks.
 */

describe("handleDispositionFailure", () => {
    it("resets submittedStatus to null so disposition buttons + notes unlock", () => {
        const setSubmittedStatus = vi.fn();
        const addNotification = vi.fn();

        const result = handleDispositionFailure({
            setSubmittedStatus,
            addNotification,
            error: new Error("network blip"),
        });

        expect(setSubmittedStatus).toHaveBeenCalledTimes(1);
        expect(setSubmittedStatus).toHaveBeenCalledWith(null);
        expect(result).toBeNull();
    });

    it("dispatches an error notification with the standardised title/message", () => {
        const setSubmittedStatus = vi.fn();
        const addNotification = vi.fn();

        handleDispositionFailure({
            setSubmittedStatus,
            addNotification,
            error: new Error("boom"),
        });

        expect(addNotification).toHaveBeenCalledTimes(1);
        const arg = addNotification.mock.calls[0][0];
        expect(arg.type).toBe("error");
        expect(arg.title).toMatch(/Protocol Failed/i);
        expect(typeof arg.message).toBe("string");
    });

    it("calls setSubmittedStatus BEFORE notify (state-unlock takes priority over user feedback)", () => {
        const ordering: string[] = [];
        const setSubmittedStatus = vi.fn(() => ordering.push("clear"));
        const addNotification = vi.fn(() => ordering.push("notify"));

        handleDispositionFailure({
            setSubmittedStatus,
            addNotification,
            error: new Error("oops"),
        });

        expect(ordering).toEqual(["clear", "notify"]);
    });

    it("uses the provided title/message overrides when supplied (pipeline-override callers)", () => {
        const setSubmittedStatus = vi.fn();
        const addNotification = vi.fn();

        handleDispositionFailure({
            setSubmittedStatus,
            addNotification,
            error: new Error("oops"),
            title: "Override Refused",
            message: "Uplink failed.",
        });

        // State unlock still happens regardless of copy
        expect(setSubmittedStatus).toHaveBeenCalledWith(null);
        const arg = addNotification.mock.calls[0][0];
        expect(arg.title).toBe("Override Refused");
        expect(arg.message).toBe("Uplink failed.");
    });
});
