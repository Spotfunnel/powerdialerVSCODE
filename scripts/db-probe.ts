/**
 * Read-only forensics for the "Unknown Company" pollution. Drills into
 * the 714 affected rows: source, state, industry, and creation-date
 * clusters. Tells us which CSV import each batch likely came from.
 */

import { prisma } from "../src/lib/prisma";

async function main() {
    const SENTINELS = ["Unknown Company"];

    const bySource = await prisma.lead.groupBy({
        by: ["source"],
        where: { companyName: { in: SENTINELS } },
        _count: { _all: true },
    });
    console.log("[probe] 'Unknown Company' rows by `source`:");
    for (const r of bySource.sort((a, b) => b._count._all - a._count._all)) {
        console.log(`  ${(r.source ?? "(null)").padEnd(20)} ${r._count._all}`);
    }

    const byState = await prisma.lead.groupBy({
        by: ["state"],
        where: { companyName: { in: SENTINELS } },
        _count: { _all: true },
    });
    console.log("\n[probe] 'Unknown Company' rows by `state`:");
    for (const r of byState.sort((a, b) => b._count._all - a._count._all).slice(0, 10)) {
        console.log(`  ${(r.state ?? "(null)").padEnd(15)} ${r._count._all}`);
    }

    const byIndustry = await prisma.lead.groupBy({
        by: ["industry"],
        where: { companyName: { in: SENTINELS } },
        _count: { _all: true },
    });
    console.log("\n[probe] 'Unknown Company' rows by `industry`:");
    for (const r of byIndustry.sort((a, b) => b._count._all - a._count._all).slice(0, 15)) {
        console.log(`  ${(r.industry ?? "(null)").padEnd(30)} ${r._count._all}`);
    }

    // Created-date clustering — likely batches from individual CSV imports
    const dates = await prisma.$queryRawUnsafe<{ d: string; n: bigint }[]>(`
        SELECT DATE("createdAt")::text AS d, COUNT(*)::bigint AS n
          FROM "Lead"
         WHERE "companyName" = 'Unknown Company'
      GROUP BY DATE("createdAt")
      ORDER BY n DESC
         LIMIT 15;
    `);
    console.log("\n[probe] 'Unknown Company' rows by createdAt date (top batches):");
    for (const r of dates) {
        console.log(`  ${r.d}  ${String(r.n).padStart(5)}`);
    }
}

main()
    .catch(err => { console.error("[probe] FAILED:", err.message ?? err); process.exit(1); })
    .finally(() => prisma.$disconnect());
