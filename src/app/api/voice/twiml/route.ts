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

        // Smart rotation: select number with cooldown awareness
        const result = await selectOutboundNumber({
            userId,
            targetNumber: to,
            channel: "CALL"
        });

        let callerId = result?.phoneNumber || "";

        // Final fallback if rotation returned nothing
        if (!callerId) {
            const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
            callerId = settings?.twilioFromNumbers?.split(',')[0]?.trim() || "";
        }

        // Normalize Caller ID
        if (callerId && !callerId.startsWith('+')) {
            if (callerId.startsWith('0')) callerId = '+61' + callerId.substring(1);
            else callerId = '+61' + callerId;
        }

        if (!to) {
            response.say("Invalid number.");
            return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } });
        }

        // Dialing Logic
        const dial = response.dial({ callerId });

        // Normalize Target Number
        let target = to;
        if (!target.startsWith('+') && !target.startsWith('client:')) {
            if (target.startsWith('0')) target = '+61' + target.substring(1);
            else target = '+61' + target;
        }

        if (target.startsWith('client:')) {
            dial.client(target.replace('client:', ''));
        } else {
            dial.number(target);
        }

        // Audit Log (Async)
        if (userId) {
            prisma.lead.findFirst({ where: { phoneNumber: to } }).then(lead => {
                if (lead) {
                    prisma.call.create({
                        data: {
                            userId,
                            fromNumber: callerId,
                            toNumber: to,
                            direction: 'OUTBOUND',
                            status: 'initiated',
                            leadId: lead.id,
                        }
                    }).catch(e => console.error("[TwiML] Call Log Error:", e));
                }
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
