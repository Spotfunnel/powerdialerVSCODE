/**
 * Reclaim 6 numbers that were temporarily routed to the Acquire project,
 * pointing their Twilio inbound webhooks back to PowerDialer and restoring
 * NumberPool state (isActive=true, regionTag='AU', owners as before).
 *
 * The 5 previously-archived numbers are re-activated with their original owners.
 * +61468073731 only needs its Twilio webhook flipped (NumberPool row is already
 * active and owned by Leo).
 */
import { prisma } from "../src/lib/prisma";
import { decrypt } from "../src/lib/encryption";
import twilio from "twilio";

const LEO = "cmkyw90eq00002bm2co41pnqf";
const KYE = "cmkyw90gz00012bm265kzioor";

const RECLAIM: { phone: string; owner: string | null }[] = [
  { phone: "+61468081872", owner: null }, // dormant, no owner
  { phone: "+61476856223", owner: LEO },
  { phone: "+61477869317", owner: LEO },
  { phone: "+61485037510", owner: KYE },
  { phone: "+61485037733", owner: KYE },
  { phone: "+61468073731", owner: LEO }, // already active in pool; only webhook flip needed
];

const BASE = "https://www.getspotfunnel.com";
const VOICE_URL = `${BASE}/api/twilio/inbound`;
const STATUS_URL = `${BASE}/api/twilio/status`;
const SMS_URL = `${BASE}/api/twilio/sms/inbound`;

async function main() {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!s) throw new Error("no settings");
  let apiKey = (s as any).twilioApiKey;
  let apiSecret = (s as any).twilioApiSecret;
  if (apiKey?.length > 50) apiKey = decrypt(apiKey);
  if (apiSecret?.length > 50) apiSecret = decrypt(apiSecret);

  const client = twilio(apiKey, apiSecret, { accountSid: s.twilioAccountSid! });
  const phones = RECLAIM.map(r => r.phone);

  // 1. Twilio webhooks — repoint to PowerDialer
  const live = await client.incomingPhoneNumbers.list({ limit: 100 });
  const bySid: Record<string, string> = {};
  for (const p of phones) {
    const n = live.find(x => x.phoneNumber === p);
    if (!n) { console.warn(`[reclaim] ${p} not found in Twilio account — skipping`); continue; }
    bySid[p] = n.sid;
  }

  console.log("\n[reclaim] Repointing Twilio webhooks...");
  for (const p of phones) {
    const sid = bySid[p];
    if (!sid) continue;
    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: VOICE_URL,
      voiceMethod: "POST",
      statusCallback: STATUS_URL,
      statusCallbackMethod: "POST",
      smsUrl: SMS_URL,
      smsMethod: "POST",
    });
    console.log(`  ${p}  →  voice/sms back to powerdialer`);
  }

  // 2. NumberPool — restore active state + owners
  console.log("\n[reclaim] Restoring NumberPool rows...");
  for (const { phone, owner } of RECLAIM) {
    const row = await prisma.numberPool.findUnique({ where: { phoneNumber: phone } });
    if (!row) { console.warn(`  ${phone}  NOT in NumberPool — skipped`); continue; }
    await prisma.numberPool.update({
      where: { phoneNumber: phone },
      data: {
        isActive: true,
        regionTag: "AU",
        cooldownUntil: null,
        ownerUserId: owner,
      },
    });
    console.log(`  ${phone}  active=true region=AU owner=${owner ?? "(none)"}`);
  }

  // 3. Verify
  console.log("\n[reclaim] Verification:");
  const after = await prisma.numberPool.findMany({
    where: { phoneNumber: { in: phones } },
    orderBy: { phoneNumber: "asc" },
  });
  for (const r of after) {
    console.log(`  ${r.phoneNumber}  active=${r.isActive}  region=${r.regionTag}  owner=${r.ownerUserId ?? "(none)"}  cooldown=${r.cooldownUntil ?? "null"}`);
  }

  console.log("\n[reclaim] Done.");
}

main()
  .catch((e) => { console.error("[reclaim] FAILED:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
