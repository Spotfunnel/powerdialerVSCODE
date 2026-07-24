/**
 * Pause 5 NumberPool rows in PowerDialer so the rotation stops picking
 * them for outbound calls. Their inbound webhooks are repointed to
 * Acquire in a separate Acquire-side script.
 *
 * This is reversible: re-run with the same numbers and isActive=true to
 * restore. We do NOT delete the rows — keeps lifetime call history intact.
 */

import { prisma } from "../src/lib/prisma";

const NUMBERS_FOR_ACQUIRE = [
  "+61468081872", // dormant, no owner
  "+61477869317", // Leo
  "+61476856223", // Leo
  "+61485037510", // Kye
  "+61485037733", // Kye
];

async function main() {
  const before = await prisma.numberPool.findMany({
    where: { phoneNumber: { in: NUMBERS_FOR_ACQUIRE } },
    select: { phoneNumber: true, isActive: true, lastUsedAt: true },
  });

  console.log("\n[pause] BEFORE:");
  for (const r of before) console.log(`  ${r.phoneNumber}  active=${r.isActive}  lastUsed=${r.lastUsedAt?.toISOString() ?? "(never)"}`);

  const result = await prisma.numberPool.updateMany({
    where: { phoneNumber: { in: NUMBERS_FOR_ACQUIRE } },
    data: { isActive: false },
  });

  console.log(`\n[pause] flipped isActive=false on ${result.count} rows`);

  const after = await prisma.numberPool.findMany({
    where: { phoneNumber: { in: NUMBERS_FOR_ACQUIRE } },
    select: { phoneNumber: true, isActive: true },
  });

  console.log("\n[pause] AFTER:");
  for (const r of after) console.log(`  ${r.phoneNumber}  active=${r.isActive}`);
}

main()
  .catch((err) => {
    console.error("[pause] FAILED:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
