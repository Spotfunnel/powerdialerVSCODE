import { NextResponse } from 'next/server';
import Twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { selectOutboundNumber } from '@/lib/number-rotation';
import { validateTwilioRequest } from '@/lib/twilio';
import { normalizeToE164 } from '@/lib/phone-utils';

// This is the webhook Twilio calls when the browser makes a call
export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const params = Object.fromEntries(formData.entries());

        const isValid = await validateTwilioRequest(req, req.url, params);
        if (!isValid) {
            console.error("[Security] INVALID TWILIO SIGNATURE on voice/twiml route.");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const to = formData.get('To') as string;
        const fromClient = formData.get('From') as string || 'unknown';

        const response = new Twilio.twiml.VoiceResponse();

        // Extract userId from client identity
        const userId = fromClient.startsWith('client:') ? fromClient.replace('client:', '') : undefined;

        // Region resolution priority:
        //   1. Lead's campaign.region (most authoritative)
        //   2. Target number's country code (+1 => US, +61 => AU)
        //   3. Default to AU only if number looks AU-formatted
        let region: string | undefined = undefined;
        if (to) {
            const lead = await prisma.lead.findFirst({
                where: { phoneNumber: to },
                select: { campaign: { select: { region: true } } }
            });
            const campaignRegion = (lead?.campaign as { region?: string } | null | undefined)?.region;
            if (campaignRegion) {
                region = campaignRegion;
            } else if (to.startsWith('+1')) {
                region = 'US';
            } else if (to.startsWith('+61')) {
                region = 'AU';
            }
            // If region is still undefined, rotation will fall back to any available number
        }

        // Smart rotation: select number with cooldown awareness and region filtering
        const result = await selectOutboundNumber({
            userId,
            targetNumber: to,
            channel: "CALL",
            region
        });

        let callerId = result?.phoneNumber || "";

        // Final fallback if rotation returned nothing
        if (!callerId) {
            const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
            callerId = settings?.twilioFromNumbers?.split(',')[0]?.trim() || "";
        }

        if (!to) {
            response.say("Invalid number.");
            return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } });
        }

        // Guard: never emit <Dial> with an empty callerId. Twilio rejects it
        // with error 21213 ("No 'From' number specified") and the rep hears
        // dead air with zero feedback. This fires when number rotation returns
        // null (pool exhausted / all on cooldown / transient DB error) AND
        // Settings has no fallback twilioFromNumbers.
        if (!callerId) {
            console.error("[TwiML] No caller-ID available (rotation + Settings fallback both empty). Refusing to dial.");
            response.say("No calling number is available. Please contact your administrator.");
            return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } });
        }

        // Dialing Logic.
        // NOTE: intentionally NOT using answerOnBridge. With it, the rep's
        // (browser) leg stays unanswered until the callee picks up; AU landline
        // carriers often send no early ringback to the SIP trunk, so the rep
        // hears silence and thinks the call failed, and unanswered calls show
        // dur=0 with no error. Answering the parent immediately gives Twilio's
        // synthetic ringback — clear "it's connecting" feedback for the rep.
        const dial = response.dial({ callerId });

        // Normalize Target Number (handle AU/US, including AU 1300/1800/13
        // shared-cost numbers). Defense-in-depth: even if a stale browser
        // passes "+1300xxx" — which historically slipped through the import
        // path and made Twilio reject the dial with error 13224 — the shared
        // normaliser repairs it to "+611300xxx" before <Dial> is emitted.
        let target = to;
        if (!target.startsWith('client:')) {
            target = normalizeToE164(target) || target;
        }

        if (target.startsWith('client:')) {
            dial.client(target.replace('client:', ''));
        } else {
            dial.number(target);
        }

        // Audit Log (Async) — log every outbound call, attach to a Lead if one matches.
        // Quick-call dials with no matching Lead are logged with leadId: null so they
        // still appear in recent-calls history.
        if (userId) {
            prisma.lead.findFirst({ where: { phoneNumber: to } })
                .then(lead =>
                    prisma.call.create({
                        data: {
                            userId,
                            fromNumber: callerId,
                            toNumber: to,
                            direction: 'OUTBOUND',
                            status: 'initiated',
                            leadId: lead?.id ?? null,
                        }
                    })
                )
                // Single catch covers BOTH the lead lookup and the call.create —
                // previously the outer .then() had no .catch(), so a failed
                // lead.findFirst was an unhandled rejection and the call was
                // never logged with no trace.
                .catch(e => console.error("[TwiML] Call log failed (lookup or create):", e));
        }

        return new NextResponse(response.toString(), {
            headers: { "Content-Type": "text/xml" }
        });
    } catch (error) {
        console.error("TwiML Error:", error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
