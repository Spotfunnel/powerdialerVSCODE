"use client";

/**
 * E2E test harness for the displayCompanyName helper.
 *
 * The browser test loads this page with query params describing a Lead's
 * fields and asserts that the rendered text never contains a legacy
 * "Unknown Company" / "Unknown Caller" sentinel — even when those sentinels
 * are present in the simulated DB row.
 *
 * Only built outside production. 404s in production builds.
 */

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { displayCompanyName } from "@/lib/lead-display";

function HarnessInner() {
    const params = useSearchParams();
    const lead = {
        companyName: params.get("companyName"),
        firstName: params.get("firstName"),
        lastName: params.get("lastName"),
        phoneNumber: params.get("phoneNumber"),
    };
    return (
        <div data-testid="harness-root" className="p-8 bg-zinc-100 min-h-screen">
            <h1 className="text-xl font-bold mb-2">E2E Harness — Lead Display</h1>
            <div data-testid="rendered-company" className="text-2xl font-black p-4 bg-white rounded">
                {displayCompanyName(lead)}
            </div>
            <pre data-testid="input-state" className="bg-white p-3 rounded text-xs mt-4">
                {JSON.stringify(lead, null, 2)}
            </pre>
        </div>
    );
}

export default function LeadDisplayHarness() {
    if (process.env.NODE_ENV === "production") notFound();
    return (
        <Suspense fallback={<div data-testid="harness-loading">Loading…</div>}>
            <HarnessInner />
        </Suspense>
    );
}
