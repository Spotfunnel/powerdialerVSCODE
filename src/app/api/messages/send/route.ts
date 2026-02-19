import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSMS } from '@/lib/twilio';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { to, body: messageBody, leadId } = body;

        // "to" can also come as "phone"
        const targetPhone = to || body.phone;

        if (!targetPhone || !messageBody) {
            console.error("[API] Missing fields", body);
            return NextResponse.json({ error: 'Missing "to" or "body"' }, { status: 400 });
        }

        const message = await sendSMS({
            to: targetPhone,
            body: messageBody,
            leadId,
            userId: session.user.id
        });

        return NextResponse.json(message);
    } catch (error: any) {
        console.error("Error sending message:", error);
        return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
    }
}

