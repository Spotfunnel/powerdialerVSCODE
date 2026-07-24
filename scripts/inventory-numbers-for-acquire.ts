/**
 * READ-ONLY inventory of NumberPool for the Acquire migration.
 *
 * Lists all PowerDialer numbers with:
 *   - active flag, region, owner
 *   - last-used timestamp
 *   - call volume (last 7d, last 30d, lifetime)
 *   - SMS volume (last 7d, last 30d, lifetime)
 *
 * Used to pick which numbers to repoint to Acquire's webhooks.
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60_000);

  const numbers = await prisma.numberPool.findMany({
    orderBy: { createdAt: "asc" },
    include: { owner: { select: { email: true, name: true } } },
  });

  console.log(`\n=== PowerDialer NumberPool (${numbers.length} rows) ===\n`);

  type Row = {
    phone: string;
    active: boolean;
    region: string | null;
    owner: string | null;
    lastUsed: string;
    calls7: number;
    calls30: number;
    callsLife: number;
    sms7: number;
    sms30: number;
    smsLife: number;
  };

  const rows: Row[] = [];

  for (const n of numbers) {
    const [c7, c30, cAll, s7, s30, sAll] = await Promise.all([
      prisma.call.count({ where: { fromNumber: n.phoneNumber, createdAt: { gte: d7 } } }),
      prisma.call.count({ where: { fromNumber: n.phoneNumber, createdAt: { gte: d30 } } }),
      prisma.call.count({ where: { fromNumber: n.phoneNumber } }),
      prisma.message.count({
        where: { conversation: { twilioNumber: { phoneNumber: n.phoneNumber } }, createdAt: { gte: d7 } },
      }),
      prisma.message.count({
        where: { conversation: { twilioNumber: { phoneNumber: n.phoneNumber } }, createdAt: { gte: d30 } },
      }),
      prisma.message.count({
        where: { conversation: { twilioNumber: { phoneNumber: n.phoneNumber } } },
      }),
    ]);
    rows.push({
      phone: n.phoneNumber,
      active: n.isActive,
      region: n.regionTag,
      owner: n.owner?.email ?? null,
      lastUsed: n.lastUsedAt ? n.lastUsedAt.toISOString().slice(0, 10) : "(never)",
      calls7: c7,
      calls30: c30,
      callsLife: cAll,
      sms7: s7,
      sms30: s30,
      smsLife: sAll,
    });
  }

  const header = ["Phone", "Active", "Region", "Owner", "LastUsed", "C7d", "C30d", "Clife", "S7d", "S30d", "Slife"];
  console.log(header.map((h) => h.padEnd(16)).join(""));
  console.log("-".repeat(176));

  for (const r of rows.sort((a, b) => a.calls30 + a.sms30 - (b.calls30 + b.sms30))) {
    console.log(
      [
        r.phone.padEnd(16),
        (r.active ? "yes" : "no").padEnd(16),
        (r.region ?? "-").padEnd(16),
        (r.owner ?? "-").padEnd(16),
        r.lastUsed.padEnd(16),
        String(r.calls7).padEnd(16),
        String(r.calls30).padEnd(16),
        String(r.callsLife).padEnd(16),
        String(r.sms7).padEnd(16),
        String(r.sms30).padEnd(16),
        String(r.smsLife).padEnd(16),
      ].join(""),
    );
  }

  console.log(
    `\n=== Recommendation: sort ascending by C30d+S30d, take the 5 least-active for Acquire ===\n`,
  );
}

main()
  .catch((err) => {
    console.error("[inventory] FAILED:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
