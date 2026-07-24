/**
 * Read-only forensic probe: pull from Twilio API the actual outbound call
 * outcomes + recent Alerts (which capture 401/5xx webhook errors), so we
 * can determine end-to-end whether outbound calls are reaching Twilio,
 * being placed, and whether /api/voice/twiml is throwing signature 401s.
 */

import { prisma } from "../src/lib/prisma";
import { decrypt } from "../src/lib/encryption";
import twilio from "twilio";

async function main() {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!settings) { console.error("No settings"); return; }

    const accountSid = settings.twilioAccountSid!;
    let apiKey = (settings as any).twilioApiKey;
    let apiSecret = (settings as any).twilioApiSecret;
    let authToken = (settings as any).twilioAuthToken;
    if (apiKey && apiKey.length > 50) apiKey = decrypt(apiKey);
    if (apiSecret && apiSecret.length > 50) apiSecret = decrypt(apiSecret);
    if (authToken && authToken.length > 50) authToken = decrypt(authToken);

    const client = twilio(apiKey || accountSid, apiSecret || authToken, { accountSid });

    // 1. Recent outbound calls placed by this account (Twilio's view of reality)
    const since = new Date(Date.now() - 48 * 3600 * 1000);
    const calls = await client.calls.list({ startTimeAfter: since, limit: 30 });
    console.log(`=== Twilio CallLog: outbound calls in last 48h (${calls.length}) ===`);
    const outbound = calls.filter(c => c.direction.startsWith("outbound"));
    for (const c of outbound) {
        console.log(`  ${c.dateCreated.toISOString().slice(0, 19)}  sid=${c.sid}  ${c.from} → ${c.to}  status=${c.status}  duration=${c.duration ?? "-"}  parentSid=${c.parentCallSid ?? "-"}`);
    }

    // 2. Recent Twilio alerts (webhook errors, 401s, validation failures)
    const alerts = await client.monitor.v1.alerts.list({
        startDate: since,
        limit: 30,
    });
    console.log(`\n=== Twilio Monitor Alerts in last 48h (${alerts.length}) ===`);
    for (const a of alerts) {
        console.log(`  ${a.dateCreated.toISOString().slice(0, 19)}  errorCode=${a.errorCode}  ${a.alertText?.slice(0, 200)}`);
        if (a.requestUrl) console.log(`    requestUrl: ${a.requestUrl}`);
        if (a.responseCode) console.log(`    responseCode: ${a.responseCode}`);
    }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
