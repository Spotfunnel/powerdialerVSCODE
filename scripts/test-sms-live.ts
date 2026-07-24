/**
 * One-shot live SMS test: invokes the same sendSMS() library function the
 * /api/messaging/send route uses, posts a single test message to a chosen
 * cell, then prints the Twilio SID and the resulting Message DB row.
 *
 * Usage:
 *   npx tsx scripts/test-sms-live.ts
 */
import { prisma } from "../src/lib/prisma";
import { sendSMS } from "../src/lib/twilio";

const TO = "+61478737917"; // Leo's cell
const BODY = "SpotFunnel SMS pipeline test — ignore.";
const SENDER_EMAIL = "leo@getspotfunnel.com";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: SENDER_EMAIL } });
  if (!user) throw new Error(`User ${SENDER_EMAIL} not found`);

  console.log(`[test-sms] firing live SMS`);
  console.log(`  from-user: ${user.email} (${user.id})`);
  console.log(`  to:        ${TO}`);
  console.log(`  body:      "${BODY}"`);

  const before = Date.now();
  const result = await sendSMS({ to: TO, body: BODY, userId: user.id });
  const elapsed = Date.now() - before;

  console.log(`\n[test-sms] sendSMS returned in ${elapsed}ms`);
  console.log("twilioSid:", (result as any)?.sid ?? "(none)");
  console.log("status:   ", (result as any)?.status ?? "(none)");

  // Find the Message DB row we just created
  const recent = await prisma.message.findMany({
    where: {
      direction: "OUTBOUND",
      body: BODY,
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { conversation: { include: { twilioNumber: true } } },
  });

  if (recent.length === 0) {
    console.log("\n[test-sms] WARNING: no matching Message row found");
    return;
  }

  const m = recent[0];
  console.log("\n[test-sms] Message row:");
  console.log(`  id:          ${m.id}`);
  console.log(`  twilioSid:   ${m.twilioSid ?? "(null)"}`);
  console.log(`  status:      ${m.status}`);
  console.log(`  direction:   ${m.direction}`);
  console.log(`  from (pool): ${m.conversation?.twilioNumber?.phoneNumber ?? "(unknown)"}`);
  console.log(`  to:          ${m.conversation?.contactPhone ?? "(unknown)"}`);
  console.log(`  createdAt:   ${m.createdAt.toISOString()}`);
}

main()
  .catch((e) => {
    console.error("[test-sms] FAILED:", e?.message ?? e);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
