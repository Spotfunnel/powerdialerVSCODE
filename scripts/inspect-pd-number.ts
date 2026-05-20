import { prisma } from "../src/lib/prisma";
import { decrypt } from "../src/lib/encryption";
import twilio from "twilio";

async function main() {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" } });
  let k = (s as any).twilioApiKey, sc = (s as any).twilioApiSecret;
  if (k?.length > 50) k = decrypt(k);
  if (sc?.length > 50) sc = decrypt(sc);
  const c = twilio(k, sc, { accountSid: s!.twilioAccountSid! });
  const nums = await c.incomingPhoneNumbers.list({ phoneNumber: "+61468073873", limit: 1 });
  if (!nums[0]) { console.log("not found"); return; }
  const x = nums[0];
  console.log(JSON.stringify({
    sid: x.sid,
    voiceUrl: x.voiceUrl, voiceMethod: x.voiceMethod,
    voiceFallbackUrl: x.voiceFallbackUrl, voiceFallbackMethod: x.voiceFallbackMethod,
    statusCallback: x.statusCallback, statusCallbackMethod: x.statusCallbackMethod,
    smsUrl: x.smsUrl, smsMethod: x.smsMethod,
    smsFallbackUrl: x.smsFallbackUrl, smsFallbackMethod: x.smsFallbackMethod,
    smsApplicationSid: x.smsApplicationSid,
    voiceApplicationSid: x.voiceApplicationSid,
  }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
