/**
 * One-shot remediation for the "Unknown Company" / "Unknown Caller"
 * pollution found by scripts/db-probe.ts (753 rows total).
 *
 * Strategy: set companyName = phoneNumber. This is real data, matches what
 * the post-fix inbound auto-create code now writes, and is fully reversible
 * — re-importing the original CSV via /api/crm/import will overwrite the
 * placeholder phoneNumber with the real company name (the update path in
 * the route now writes companyName whenever the CSV row supplies one).
 *
 * Idempotent: re-running after the fix reports 0 affected rows.
 */

import { prisma } from "../src/lib/prisma";

const SENTINELS = ["Unknown Company", "Unknown Caller", "Unknown Business", "Unknown"];

async function main() {
    const before = await prisma.lead.count({ where: { companyName: { in: SENTINELS } } });
    console.log(`[fix] ${before} affected rows to clean up.`);
    if (before === 0) return;

    // Use raw SQL: a single UPDATE is faster than per-row Prisma calls and
    // avoids any chance of update-collision. The schema requires phoneNumber
    // non-null and unique, so it is always present and safe to copy in.
    const { count } = await prisma.$executeRaw`
        UPDATE "Lead"
           SET "companyName" = "phoneNumber",
               "updatedAt"   = NOW()
         WHERE "companyName" IN ('Unknown Company', 'Unknown Caller', 'Unknown Business', 'Unknown')
    ` as unknown as { count: number };

    // $executeRaw returns the affected row count as a number, not an object
    const affected = Number(count ?? 0);

    const after = await prisma.lead.count({ where: { companyName: { in: SENTINELS } } });
    console.log(`[fix] UPDATE returned ${affected}; remaining sentinel rows: ${after}`);
    if (after !== 0) {
        console.error(`[fix] Remediation incomplete — ${after} rows still match a sentinel.`);
        process.exit(2);
    }
    console.log(`[fix] Done. Cleared ${before} rows.`);
}

main()
    .catch(err => { console.error("[fix] FAILED:", err); process.exit(1); })
    .finally(() => prisma.$disconnect());
