/**
 * Read-only diagnostic: verify the TwiML App SID + API Key + incoming numbers
 * in the Twilio account. Run when the dialer Device is stuck in 'error' state
 * after a number-transfer or credential swap.
 */
import { prisma } from "../src/lib/prisma";
import { decrypt } from "../src/lib/encryption";
import twilio from "twilio";

async function main() {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!s) { console.log("no settings"); return; }

  let apiKey = (s as any).twilioApiKey;
  let apiSecret = (s as any).twilioApiSecret;
  if (apiKey && apiKey.length > 50) apiKey = decrypt(apiKey);
  if (apiSecret && apiSecret.length > 50) apiSecret = decrypt(apiSecret);

  console.log("AccountSid :", s.twilioAccountSid);
  console.log("TwiMLAppSid:", s.twilioAppSid);
  console.log("ApiKey pfx :", apiKey?.slice(0, 6));

  const client = twilio(apiKey, apiSecret, { accountSid: s.twilioAccountSid! });

  try {
    const app = await client.applications(s.twilioAppSid!).fetch();
    console.log(`\nTwiML App OK: "${app.friendlyName}"  voiceUrl=${app.voiceUrl}`);
  } catch (e: any) {
    console.log(`\nTwiML App FETCH FAILED: status=${e.status} code=${e.code} msg=${e.message}`);
  }

  try {
    const apps = await client.applications.list({ limit: 20 });
    console.log(`\nAvailable apps in account (${apps.length}):`);
    for (const a of apps) console.log(` - ${a.sid} | ${a.friendlyName} | ${a.voiceUrl}`);
  } catch (e: any) {
    console.log(`apps.list FAILED: ${e.message}`);
  }

  try {
    const nums = await client.incomingPhoneNumbers.list({ limit: 50 });
    console.log(`\nIncoming numbers (${nums.length}):`);
    for (const n of nums) {
      console.log(` - ${n.phoneNumber}  voice=${(n.voiceUrl ?? "").slice(0, 70)}  sms=${(n.smsUrl ?? "").slice(0, 70)}`);
    }
  } catch (e: any) {
    console.log(`incomingPhoneNumbers.list FAILED: ${e.message}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
