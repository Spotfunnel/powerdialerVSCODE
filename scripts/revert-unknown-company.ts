/**
 * Revert the cleanup performed by scripts/fix-unknown-company.ts.
 *
 * Targeting fingerprint: rows where companyName === phoneNumber AND
 * updatedAt is within the last 30 minutes — narrowed by source so we
 * restore the correct sentinel value:
 *
 *   - source = 'INBOUND_CALL'                  → restore "Unknown Caller"
 *   - source IN ('IMPORT_NEW','IMPORT_MERGE')  → restore "Unknown Company"
 *
 * The fix script also touched updatedAt = NOW(), giving us a clean window
 * to scope the revert and avoid clobbering legitimate post-fix inbound
 * auto-creates whose companyName genuinely equals phoneNumber.
 */

import { prisma } from "../src/lib/prisma";

async function main() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    const candidates = await prisma.lead.count({
        where: {
            updatedAt: { gte: cutoff },
            // companyName matches phoneNumber on the same row — Prisma can't
            // express that directly, so we filter via raw SQL below.
        },
    });
    console.log(`[revert] candidate window has ${candidates} recently-updated rows.`);

    // Two narrow UPDATEs based on the source field
    const callerResult = await prisma.$executeRaw`
        UPDATE "Lead"
           SET "companyName" = 'Unknown Caller'
         WHERE "companyName" = "phoneNumber"
           AND "source" = 'INBOUND_CALL'
           AND "updatedAt" >= ${cutoff}
    `;
    console.log(`[revert] restored 'Unknown Caller': ${callerResult} rows`);

    const companyResult = await prisma.$executeRaw`
        UPDATE "Lead"
           SET "companyName" = 'Unknown Company'
         WHERE "companyName" = "phoneNumber"
           AND "source" IN ('IMPORT_NEW', 'IMPORT_MERGE')
           AND "updatedAt" >= ${cutoff}
    `;
    console.log(`[revert] restored 'Unknown Company': ${companyResult} rows`);

    const after = await prisma.lead.count({
        where: { companyName: { in: ["Unknown Company", "Unknown Caller", "Unknown Business", "Unknown"] } },
    });
    console.log(`[revert] sentinel rows now in DB: ${after}`);
}

main()
    .catch(err => { console.error("[revert] FAILED:", err); process.exit(1); })
    .finally(() => prisma.$disconnect());
