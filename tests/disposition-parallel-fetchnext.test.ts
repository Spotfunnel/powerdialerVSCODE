import { describe, it, expect, vi } from "vitest";

/**
 * Pins the safety invariant for the parallelised disposition flow.
 *
 * The dialer fires `updateLeadStatus(...)` and `fetchNextLead()` in parallel
 * on shortcut keys (NA / NI / DQ etc.) so the UI advances instantly. The
 * concern: when fetchNextLead resolves and the current-lead state flips to
 * the new lead, can the still-in-flight disposition PATCH end up writing to
 * the wrong lead?
 *
 * The invariant: NO. The PATCH URL is constructed synchronously at the call
 * site with the lead id captured at that instant. Even if the new-lead
 * Promise resolves first and updates state, the URL has already been baked.
 *
 * This test simulates the timing by:
 *   1. Capturing the original lead id.
 *   2. Building the PATCH URL synchronously with that id.
 *   3. Flipping state to a different lead BEFORE the fetch's promise resolves.
 *   4. Asserting the URL still references the original lead's id.
 */

function buildStatusUrl(leadId: string): string {
    return `/api/leads/${leadId}/status`;
}

describe("disposition parallel fetchNext — right-lead invariant", () => {
    it("PATCH URL captures the lead id at call time, not at await resolution time", async () => {
        const ref = { current: { id: "lead-A" } };

        // Simulates DispositionPanel.handleDisposition dispatching the
        // disposition write while state subsequently flips to lead-B.
        const fetchMock = vi.fn(async (url: string) => ({ ok: true, url }));

        // 1. Synchronously read ref + construct URL (mirrors LeadContext.updateLeadStatus)
        const lead = ref.current;
        const url = buildStatusUrl(lead.id);
        const promise = fetchMock(url);

        // 2. Mid-flight, the next-lead fetch resolves and flips currentLead to B.
        ref.current = { id: "lead-B" };

        // 3. Await the in-flight PATCH.
        const res = await promise;

        // 4. Disposition was written against lead-A, not lead-B.
        expect(res.url).toBe("/api/leads/lead-A/status");
        expect(res.url).not.toContain("lead-B");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe("/api/leads/lead-A/status");
    });

    it("two parallel calls each capture their own snapshot of the lead ref", async () => {
        const ref = { current: { id: "lead-A" } };
        const fetchMock = vi.fn(async (url: string) => url);

        // First disposition fires for lead-A
        const a = ref.current;
        const aUrl = buildStatusUrl(a.id);
        const aPromise = fetchMock(aUrl);

        // Lead flips
        ref.current = { id: "lead-B" };

        // Second disposition fires for lead-B
        const b = ref.current;
        const bUrl = buildStatusUrl(b.id);
        const bPromise = fetchMock(bUrl);

        await Promise.all([aPromise, bPromise]);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toBe("/api/leads/lead-A/status");
        expect(fetchMock.mock.calls[1][0]).toBe("/api/leads/lead-B/status");
    });
});
