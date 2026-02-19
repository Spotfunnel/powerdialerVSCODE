import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCallBridge } from "@/lib/twilio";
import { getRotatingNumber } from "@/lib/dialer-logic";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { leadId } = await req.json();
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });

        if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

        // Get current user ID
        const session = await getServerSession(authOptions) as any;
        const userId = session?.user?.id;

        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const fromNumber = await getRotatingNumber(userId);
        if (!fromNumber) return NextResponse.json({ error: "No caller IDs available" }, { status: 500 });

        const callSid = await createCallBridge(fromNumber, lead.phoneNumber, lead.id);

        // Save call record
        await prisma.call.create({
            data: {
                leadId: lead.id,
                twilioSid: callSid,
                fromNumber,
                toNumber: lead.phoneNumber,
                userId: userId,
                status: 'queued', // Initial status
                direction: 'OUTBOUND'
            }
        });

        // Update lead status
        await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'IN_CALL' } // Use string literal to avoid import issues
        });

        return NextResponse.json({ callSid });
    } catch (error: any) {
        console.error("Call Start Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
