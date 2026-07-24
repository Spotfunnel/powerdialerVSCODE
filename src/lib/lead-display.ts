/**
 * Helpers for choosing what to write into Lead.companyName at create time
 * and what to render in the UI when companyName is missing or stamped with a
 * legacy sentinel value.
 *
 * Why: Lead.companyName is required (non-null) in the schema, so the codebase
 * historically defaulted to "Unknown Company" / "Unknown Caller" whenever a
 * CSV lacked a company column or an inbound caller had no record. Those
 * sentinels then leaked into the dialer UI, history, pipeline and TwiML —
 * which is what users see and complain about.
 *
 * The contract enforced here:
 *  - We never write a sentinel string. The fallback chain is name → phone.
 *  - At display time, any leftover legacy sentinel (from old DB rows the
 *    backfill script may not have reached yet) is stripped out and replaced
 *    with the same name → phone fallback.
 */

export const LEGACY_COMPANY_SENTINELS: ReadonlySet<string> = new Set([
    "Unknown Company",
    "Unknown Caller",
    "Unknown Business",
    "Unknown",
]);

/**
 * The value to write into Lead.companyName when no real company name was
 * supplied. In practice every CSV imported through the dashboard has a
 * company column — this fallback only exists because the schema declares
 * companyName as non-null, so we need *something* defensible to write for
 * the rare inbound-auto-create path. Use the phone number; never a sentinel
 * string and never a person's name (which is a different field).
 */
export function fallbackCompanyName(input: { phoneNumber: string }): string {
    return input.phoneNumber;
}

/**
 * The value to render in the UI for a lead's company name. Sanitises legacy
 * sentinels still sitting in the DB so old polluted rows do not display
 * "Unknown Company"; falls back to the phone number (real data on the row)
 * rather than a name field.
 */
export function displayCompanyName(
    lead: {
        companyName?: string | null;
        phoneNumber?: string | null;
    },
    dash: string = "—",
): string {
    const name = lead.companyName?.trim();
    if (name && !LEGACY_COMPANY_SENTINELS.has(name)) return name;
    if (lead.phoneNumber) return lead.phoneNumber;
    return dash;
}
