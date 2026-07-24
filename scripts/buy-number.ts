/**
 * Buys ONE Australian number, wires its webhooks to production, and registers
 * it in NumberPool so the dialer has an outbound caller-ID.
 *
 * SAFETY GUARDS (this script provisions a paid resource):
 *   - Refuses to run if NumberPool already has ANY number (buy-once).
 *   - Buys exactly one; never loops.
 *   - Does NOT touch any pre-existing number on the account.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL (optional).
 */

import 'dotenv/config';
import { prisma } from "../src/lib/prisma";

const SID = process.env.TWILIO_ACCOUNT_SID!;
const TOK = process.env.TWILIO_AUTH_TOKEN!;
const BASE = (process.env.WEBHOOK_BASE_URL || "https://www.getspotfunnel.com").replace(/\/$/, "");
const VOICE_URL = `${BASE}/api/twilio/inbound`;
const SMS_URL = `${BASE}/api/twilio/sms/inbound`;
const STATUS_URL = `${BASE}/api/twilio/status`;

const auth = () => "Basic " + Buffer.from(`${SID}:${TOK}`).toString("base64");
const api = (p: string) => `https://api.twilio.com/2010-04-01/Accounts/${SID}${p}`;

async function getJson(url: string) {
    const r = await fetch(url, { headers: { Authorization: auth() } });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

async function findAvailable(): Promise<string | null> {
    for (const kind of ["Mobile", "Local"]) {
        const r = await getJson(api(`/AvailablePhoneNumbers/AU/${kind}.json?VoiceEnabled=true&SmsEnabled=true&PageSize=5`));
        const list = (r.body as any).available_phone_numbers || [];
        if (list.length) {
            console.log(`  found ${list.length} available AU ${kind} number(s); picking ${list[0].phone_number}`);
            return list[0].phone_number;
        }
        console.log(`  no AU ${kind} numbers available`);
    }
    return null;
}

async function pickValidatedAddress(): Promise<string | null> {
    const r = await getJson(api(`/Addresses.json?PageSize=20`));
    const addrs = ((r.body as any).addresses || []).filter((a: any) => a.validated && a.iso_country === "AU");
    return addrs[0]?.sid ?? null;
}

async function main() {
    if (!SID || !TOK) throw new Error("Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN");

    // Guard: never buy if the pool is already populated.
    const existing = await prisma.numberPool.count();
    if (existing > 0) {
        const nums = await prisma.numberPool.findMany({ select: { phoneNumber: true, isActive: true } });
        console.log(`NumberPool already has ${existing} number(s) — refusing to buy another:`);
        nums.forEach(n => console.log(`  ${n.phoneNumber} (active=${n.isActive})`));
        return;
    }

    console.log("Searching for an available AU number…");
    const phoneNumber = await findAvailable();
    if (!phoneNumber) throw new Error("No AU numbers available to purchase right now.");

    const addressSid = await pickValidatedAddress();
    console.log(addressSid ? `  using validated address ${addressSid}` : "  no validated AU address found (attempting without)");

    console.log(`Purchasing ${phoneNumber}…`);
    const body = new URLSearchParams({
        PhoneNumber: phoneNumber,
        FriendlyName: "PowerDialer Outbound",
        VoiceUrl: VOICE_URL,
        VoiceMethod: "POST",
        SmsUrl: SMS_URL,
        SmsMethod: "POST",
        StatusCallback: STATUS_URL,
        StatusCallbackMethod: "POST",
    });
    // AU mobile needs BOTH the approved bundle AND the exact address that bundle
    // was built with (a different address -> 21651; none -> 21631). ADDRESS_SID
    // overrides the auto-pick so we can pass the bundle's own address.
    const useAddress = process.env.ADDRESS_SID || addressSid;
    if (process.env.BUNDLE_SID) {
        body.set("BundleSid", process.env.BUNDLE_SID);
        console.log(`  using regulatory bundle ${process.env.BUNDLE_SID}`);
    }
    if (useAddress) {
        body.set("AddressSid", useAddress);
        console.log(`  using address ${useAddress}`);
    }

    const res = await fetch(api(`/IncomingPhoneNumbers.json`), {
        method: "POST",
        headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const purchased: any = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`Purchase failed: ${res.status} — ${purchased?.message || JSON.stringify(purchased)} (code ${purchased?.code ?? "?"})`);
    }

    console.log(`  PURCHASED ${purchased.phone_number} (sid ${purchased.sid})`);
    console.log(`  voice_url=${purchased.voice_url}`);
    console.log(`  sms_url  =${purchased.sms_url}`);

    // Register in NumberPool + set as Settings fallback caller-ID.
    await prisma.numberPool.create({
        data: { phoneNumber: purchased.phone_number, isActive: true, regionTag: "AU" },
    });
    await prisma.settings.update({
        where: { id: "singleton" },
        data: { twilioFromNumbers: purchased.phone_number },
    });

    console.log(`\nRegistered ${purchased.phone_number} in NumberPool (regionTag=AU) and set as Settings.twilioFromNumbers.`);
    console.log("The dialer now has an outbound caller-ID.");
}

main()
    .catch(e => { console.error("FAILED:", e?.message ?? e); process.exit(1); })
    .finally(() => prisma.$disconnect());
