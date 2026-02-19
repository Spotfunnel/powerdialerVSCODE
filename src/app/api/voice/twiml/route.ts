import { NextResponse } from 'next/server';
import Twilio from 'twilio';
import { prisma } from '@/lib/prisma';

// This is the webhook Twilio calls when the browser makes a call
export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const to = formData.get('To') as string;
        const fromClient = formData.get('From') as string || 'unknown';

        const response = new Twilio.twiml.VoiceResponse();

        // 1. Get Settings and Pool in Parallel
        const [settings, pool] = await Promise.all([
            prisma.settings.findUnique({ where: { id: 'singleton' } }),
            prisma.numberPool.findMany({ where: { isActive: true } })
        ]);

        // Fallback Strategy
        const rawFrom = settings?.twilioFromNumbers || process.env.TWILIO_FROM_NUMBER || "";
        let callerId = rawFrom.split(',')[0].trim();

        // DEBUG LOGGING THE ATTEMPT (Non-blocking)
        prisma.webhookPing.create({
            data: {
                source: 'TWIML_OUTBOUND_DEBUG',
                data: JSON.stringify({
                    fromClient,
                    to,
                    initialFallback: callerId,
                    poolSize: pool.length
                })
            }
        }).catch(e => console.error("[TwiML] DB Log Error:", e));

        // 2. Prioritize Number Pool Rotation
        if (pool.length > 0) {
            // Match area code if to looks like a number
            const toClean = (to || '').replace(/\D/g, '');
            if (toClean.length >= 3) {
                const targetAreaCode = toClean.substring(2, 3); // +61 2... -> index 2 is '2'
                const match = pool.find(n => n.phoneNumber.replace(/\D/g, '').substring(2, 3) === targetAreaCode);
                if (match) {
                    callerId = match.phoneNumber;
                    console.log(`[TwiML] Pool Area Match: ${callerId}`);
                } else {
                    callerId = pool[Math.floor(Math.random() * pool.length)].phoneNumber;
                    console.log(`[TwiML] Pool Random Rotation: ${callerId}`);
                }
            } else {
                callerId = pool[Math.floor(Math.random() * pool.length)].phoneNumber;
            }
        }

        // 3. Normalize Caller ID
        if (callerId && !callerId.startsWith('+')) {
            if (callerId.startsWith('0')) callerId = '+61' + callerId.substring(1);
            else callerId = '+61' + callerId;
        }

        if (!to) {
            response.say("Invalid number.");
            return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } });
        }

        // 4. Dialing Logic
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

        // 5. Audit Log (Async)
        if (fromClient.startsWith('client:')) {
            const userId = fromClient.replace('client:', '');
            // We use static lead lookup to associate the call
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
