import { NextResponse } from 'next/server';
import Twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { selectOutboundNumber } from '@/lib/number-rotation';

// This is the webhook Twilio calls when the browser makes a call
export async function POST(req: Request) {
    try {
        const formData = await req.formData();
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

        // Dialing Logic
        const dial = response.dial({ callerId });

        // Normalize Target Number (handle both AU and US)
        let target = to;
        if (!target.startsWith('+') && !target.startsWith('client:')) {
            const digits = target.replace(/\D/g, '');
            if (digits.startsWith('0')) target = '+61' + digits.substring(1);
            else if (digits.length === 10 && /^[2-9]/.test(digits)) target = '+1' + digits;
            else if (digits.length === 11 && digits.startsWith('1')) target = '+' + digits;
            else target = '+' + digits;
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
            prisma.lead.findFirst({ where: { phoneNumber: to } }).then(lead => {
                prisma.call.create({
                    data: {
                        userId,
                        fromNumber: callerId,
                        toNumber: to,
                        direction: 'OUTBOUND',
                        status: 'initiated',
                        leadId: lead?.id ?? null,
                    }
                }).catch(e => console.error("[TwiML] Call Log Error:", e));
            });
        }

        return new NextResponse(response.toString(), {
            headers: { "Content-Type": "text/xml" }
        });
    } catch (error) {
        console.error("TwiML Error:", error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
