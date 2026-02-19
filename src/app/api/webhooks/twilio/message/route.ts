import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const Body = formData.get('Body') as string;
        const From = formData.get('From') as string;
        const To = formData.get('To') as string;
        const MessageSid = formData.get('MessageSid') as string;
        const SmsStatus = formData.get('SmsStatus') as string;

        console.log(`[Twilio Webhook] Incoming message from ${From}: ${Body}`);

        if (!From || !Body) {
            return new NextResponse('<Response></Response>', {
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        // Find the lead associated with this number
        // Twilio numbers are usually E.164, e.g. +1234567890
        // Our DB might store them differently, so we might need fuzzy match or normalization.
        // For now, assuming exact match or simple clean.

        // Try finding lead by exact match
        let lead = await prisma.lead.findUnique({
            where: { phoneNumber: From }
        });

        // If not found, try finding by normalized (if needed). 
        // Currently skipping fuzzy matching for speed.

        if (lead) {
            await prisma.message.create({
                data: {
                    sid: MessageSid,
                    direction: 'INBOUND',
                    status: SmsStatus || 'received',
                    fromNumber: From,
                    toNumber: To,
                    body: Body,
                    leadId: lead.id
                }
            });
            console.log(`[Twilio Webhook] Saved message for lead ${lead.id}`);
        } else {
            // Store as unassigned message? Or create lead?
            // For now, let's just log it. 
            // Ideally we should store it without leadId if checking "all messages" is a req,
            // but current requirement is "toggle between numbers", usually implies Leads.
            console.warn(`[Twilio Webhook] No lead found for ${From}`);
            // Storing without leadId to avoid data loss
            await prisma.message.create({
                data: {
                    sid: MessageSid,
                    direction: 'INBOUND',
                    status: SmsStatus || 'received',
                    fromNumber: From,
                    toNumber: To,
                    body: Body,
                    // leadId: null 
                }
            });
        }

        return new NextResponse('<Response></Response>', {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error: any) {
        console.error("Error processing webhook:", error);
        return new NextResponse('<Response></Response>', {
            headers: { 'Content-Type': 'text/xml' },
            status: 500
        });
    }
}
