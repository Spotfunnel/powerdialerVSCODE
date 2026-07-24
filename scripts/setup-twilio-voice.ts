/**
 * Wires the browser Voice SDK config into Settings after a DB rebuild.
 *
 * The Voice access token (src/app/api/voice/token) needs FOUR things:
 *   accountSid, twilioAppSid, twilioApiKey (SK…), twilioApiSecret.
 * Only accountSid + authToken survived (re-seeded via seed-settings). The
 * API-key *secret* is shown once at creation and was lost with the old DB,
 * so a fresh key must be minted. The TwiML app itself lives in Twilio (not
 * the DB), so we reuse the existing one pointing at the production webhook.
 *
 * Idempotent: if Settings already has appSid + apiKey + apiSecret, it exits.
 * Does NOT create, buy, or modify any phone number.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ENCRYPTION_KEY (runtime key),
 *      WEBHOOK_BASE_URL (default https://www.getspotfunnel.com)
 */

import 'dotenv/config';
import { prisma } from "../src/lib/prisma";
import { encrypt } from "../src/lib/encryption";

const SID = process.env.TWILIO_ACCOUNT_SID!;
const TOK = process.env.TWILIO_AUTH_TOKEN!;
const BASE = (process.env.WEBHOOK_BASE_URL || "https://www.getspotfunnel.com").replace(/\/$/, "");
const VOICE_URL = `${BASE}/api/voice/twiml`;

function api(path: string) {
    return `https://api.twilio.com/2010-04-01/Accounts/${SID}${path}`;
}
function authHeader() {
    return "Basic " + Buffer.from(`${SID}:${TOK}`).toString("base64");
}

async function findVoiceApp(): Promise<string | null> {
    const res = await fetch(api(`/Applications.json?PageSize=50`), { headers: { Authorization: authHeader() } });
    const j: any = await res.json();
    const apps = j.applications || [];
    const exact = apps.find((a: any) => a.voice_url === VOICE_URL);
    if (exact) return exact.sid;
    return null;
}

async function createVoiceApp(): Promise<string> {
    const body = new URLSearchParams({
        FriendlyName: "PowerDialer Voice (auto)",
        VoiceUrl: VOICE_URL,
        VoiceMethod: "POST",
    });
    const res = await fetch(api(`/Applications.json`), {
        method: "POST",
        headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!res.ok) throw new Error(`create TwiML app failed: ${res.status} ${await res.text()}`);
    const j: any = await res.json();
    return j.sid;
}

async function createApiKey(): Promise<{ sid: string; secret: string }> {
    const body = new URLSearchParams({ FriendlyName: "PowerDialer Voice Key (auto)" });
    const res = await fetch(api(`/Keys.json`), {
        method: "POST",
        headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!res.ok) throw new Error(`create API key failed: ${res.status} ${await res.text()}`);
    const j: any = await res.json();
    return { sid: j.sid, secret: j.secret };
}

async function main() {
    if (!SID || !TOK || !process.env.ENCRYPTION_KEY) {
        throw new Error("Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / ENCRYPTION_KEY");
    }

    const existing = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (existing?.twilioAppSid && existing?.twilioApiKey && existing?.twilioApiSecret) {
        console.log("Voice config already present — nothing to do.");
        console.log(`  appSid=${existing.twilioAppSid}  apiKey=${existing.twilioApiKey}`);
        return;
    }

    let appSid = await findVoiceApp();
    console.log(appSid
        ? `Reusing TwiML app ${appSid} (voice_url=${VOICE_URL})`
        : `No TwiML app for ${VOICE_URL} — creating one`);
    if (!appSid) appSid = await createVoiceApp();

    const key = await createApiKey();
    console.log(`Minted API key ${key.sid} (secret shown once — storing encrypted)`);

    const updated = await prisma.settings.update({
        where: { id: "singleton" },
        data: {
            twilioAppSid: appSid,
            twilioApiKey: key.sid,               // SK… (34 chars) — stored plain, token route uses as-is
            twilioApiSecret: encrypt(key.secret), // >50 chars — token route decrypts
            webhookBaseUrl: BASE,
            setupCompleted: true,
        },
    });

    console.log("\nSettings updated:");
    console.log(`  accountSid : ${updated.twilioAccountSid}`);
    console.log(`  appSid     : ${updated.twilioAppSid}`);
    console.log(`  apiKey     : ${updated.twilioApiKey}`);
    console.log(`  apiSecret  : <encrypted, ${updated.twilioApiSecret?.length} chars>`);
    console.log(`  webhookBase: ${updated.webhookBaseUrl}`);
    console.log(`  fromNumbers: ${updated.twilioFromNumbers ?? "(none — outbound caller-ID still needed)"}`);
}

main()
    .catch(e => { console.error("FAILED:", e?.message ?? e); process.exit(1); })
    .finally(() => prisma.$disconnect());
