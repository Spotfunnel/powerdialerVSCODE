import { NextResponse } from 'next/server';
import Twilio from 'twilio';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const fromNumber = formData.get('Caller') as string || 'Unknown';
        const toNumber = formData.get('To') as string || 'Unknown';

        console.log(`[Inbound] WEBHOOK HIT (Voice Route). Caller: ${fromNumber}, To: ${toNumber}`);

        // LOGGING
        await prisma.twilioLog.create({
            data: {
                fromNumber,
                toNumber,
                direction: 'INBOUND',
                twimlContent: 'Processing...',
            }
        });

        // 1. LEAD IDENTIFICATION: Find if this person is in the CRM
        const cleanFrom = fromNumber.replace(/[\s\-\(\)\+]/g, "");
        const lead = await prisma.lead.findFirst({
            where: {
                OR: [
                    { phoneNumber: { contains: cleanFrom } },
                    { phoneNumber: { contains: fromNumber } }
                ]
            },
            select: { firstName: true, lastName: true, companyName: true, id: true }
        });

        const callerName = lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : null;
        const callerCompany = lead?.companyName || null;

        console.log(`[Inbound] Lead Identified: ${callerName || 'Unknown'} (ID: ${lead?.id || 'N/A'})`);

        // 2. Smart Routing: Find the LAST user who spoke with this person
        const lastInteraction = await prisma.call.findFirst({
            where: {
                OR: [
                    { toNumber: fromNumber },
                    { fromNumber: fromNumber }
                ]
            },
            orderBy: { createdAt: 'desc' },
            select: { userId: true }
        });

        let targetIdentity = lastInteraction?.userId;

        // Fallback: Default to Admin if no interaction
        if (!targetIdentity) {
            const admin = await prisma.user.findFirst({
                where: { role: 'ADMIN' },
                select: { id: true }
            });
            targetIdentity = admin?.id;
        }

        if (!targetIdentity) {
            console.error("[Inbound] NO TARGET IDENTITY FOUND. Hanging up.");
            const r = new Twilio.twiml.VoiceResponse();
            r.say("System error. No agent found.");

            // LOG ERROR
            await prisma.twilioLog.create({
                data: { fromNumber, toNumber, direction: 'INBOUND', errorCode: 'NO_AGENT', errorMessage: 'No target identity found' }
            });

            return new NextResponse(r.toString(), { headers: { "Content-Type": "text/xml" } });
        }

        console.log(`[Inbound] TARGET CLIENT IDENTITY: ${targetIdentity}`);

        const response = new Twilio.twiml.VoiceResponse();
        const dial = response.dial();
        const client = dial.client(targetIdentity);

        // Pass metadata to the client
        if (callerName) client.parameter({ name: 'callerName', value: callerName });
        if (callerCompany) client.parameter({ name: 'callerCompany', value: callerCompany });
        if (lead?.id) client.parameter({ name: 'leadId', value: lead.id });

        const xml = response.toString();

        // UPDATE LOG WITH TWIML
        const lastLog = await prisma.twilioLog.findFirst({ orderBy: { timestamp: 'desc' } });
        if (lastLog) {
            await prisma.twilioLog.update({
                where: { id: lastLog.id },
                data: { twimlContent: xml }
            });
        }

        return new NextResponse(xml, {
            headers: { "Content-Type": "text/xml" }
        });
    } catch (error) {
        console.error("[Inbound] ERROR:", error);
        // LOG ERROR
        try {
            await prisma.twilioLog.create({
                data: { fromNumber: 'Error', toNumber: 'Error', direction: 'INBOUND', errorCode: 'EXCEPTION', errorMessage: String(error) }
            });
        } catch (e) { }

        const r = new Twilio.twiml.VoiceResponse();
        r.say("Application error.");
        return new NextResponse(r.toString(), { headers: { "Content-Type": "text/xml" } });
    }
}
