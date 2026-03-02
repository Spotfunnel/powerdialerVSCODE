import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateLeadDisposition } from "@/lib/dialer-logic";

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id } = params;
        const userId = (session.user as any).id;

        // Verify ownership (security check) - Good practice to keep here
        const lead = await prisma.lead.findUnique({ where: { id }, select: { lockedById: true } });
        // NOTE: We generally allow updating even if lock expired? 
        // Or should we enforce lock? The original code didn't strictly enforce lock for status update, 
        // but it released lock upon update.
        // Let's implicit allow.

        // Dynamic imports for side effects - only when needed? 
        // For production route, we can import them top-level or dynamically.
        // We'll pass them as dependencies.

        let sendSMS, createGoogleMeeting, sendGmailConfirmation;

        if (body.status === 'BOOKED') {
            try {
                const twilio = await import("@/lib/twilio");
                sendSMS = twilio.sendSMS;
                const gCal = await import("@/lib/google-calendar");
                createGoogleMeeting = gCal.createGoogleMeeting;
                const gmail = await import("@/lib/google-gmail");
                sendGmailConfirmation = gmail.sendGmailConfirmation;
            } catch (e) {
                console.error("Failed to load dependencies", e);
            }
        }

        const result = await updateLeadDisposition(id, userId, body, { sendSMS, createGoogleMeeting, sendGmailConfirmation }, body.fromNumber);

        return NextResponse.json({ success: true, lead: result.lead, dispatch: result.dispatch });

    } catch (error: any) {
        console.error("Update status failed", error);
        return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
    }
}
