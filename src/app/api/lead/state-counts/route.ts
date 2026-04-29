import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma, withPrismaRetry } from "@/lib/prisma";

/**
 * Returns the count of READY (un-locked, dialable) leads grouped by state.
 * Optional `campaignId` query param scopes the counts to one campaign so
 * the dialer's state filter dropdown can show e.g. "NSW 805" inside Movers.
 *
 * Each AU state code is matched against both its abbreviation and the full
 * name ("WA" + "Western Australia") because historical imports were
 * inconsistent — same logic as getNextLead's expandedStates filter.
 */

const STATE_FULL_NAMES: Record<string, string> = {
    NSW: "New South Wales",
    VIC: "Victoria",
    QLD: "Queensland",
    SA: "South Australia",
    WA: "Western Australia",
    TAS: "Tasmania",
    NT: "Northern Territory",
    ACT: "Australian Capital Territory",
};

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId") || null;

    try {
        const rows = await withPrismaRetry(() =>
            prisma.lead.groupBy({
                by: ["state"],
                where: {
                    status: "READY",
                    lockedById: null,
                    ...(campaignId ? { campaignId } : {}),
                },
                _count: { _all: true },
            }),
            3, 1000, true,
        );

        // Normalise into { CODE: count } — collapse "WA" + "Western Australia"
        // into a single key so the picker shows one number per state.
        const counts: Record<string, number> = {};
        for (const r of rows) {
            const raw = (r.state || "").trim();
            if (!raw) continue;
            // Map full names to their AU/US code; otherwise pass through (US codes are 2-letter).
            const code = Object.entries(STATE_FULL_NAMES).find(([, name]) => name === raw)?.[0] ?? raw;
            counts[code] = (counts[code] ?? 0) + r._count._all;
        }

        return NextResponse.json({ counts });
    } catch (e: any) {
        console.error("[state-counts] failed", e);
        return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
    }
}
