
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateLeadDisposition } from "@/lib/dialer-logic";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { specialist, start, end, name, email, phone, notes, leadId } = body;

        console.log("[Calendar] Booking Request:", { specialist, start, name, leadId });

        // 1. Resolve Lead
        let lead = null;
        if (leadId) {
            lead = await prisma.lead.findUnique({ where: { id: leadId } });
        }

        if (!lead) {
            const conditions: any[] = [];

            if (phone) {
                const cleaned = phone.replace(/[\s\-\(\)]/g, "");
                const variants = [cleaned];
                // simple AU logic
                if (cleaned.startsWith('0')) variants.push(cleaned.replace(/^0/, '+61'));
                if (cleaned.startsWith('+61')) variants.push(cleaned.replace(/^\+61/, '0'));

                conditions.push({ phoneNumber: { in: variants } });
            }

            if (email) {
                conditions.push({ email: email });
            }

            if (conditions.length > 0) {
                lead = await prisma.lead.findFirst({
                    where: {
                        OR: conditions
                    }
                });
            }
        }

        if (!lead) {
            // If no lead found, we should probably create one or fail?
            // For now, let's create a temporary lead or fail if generic booking isn't supported extensively
            // But the user said "schedule FROM CRM", so we expect a lead.
            // If manual entry, let's create a lead?
            // "Kye tried to schedule directly from crm" implies existing lead.
            return NextResponse.json({ error: "Could not match record to a Lead in CRM" }, { status: 400 });
        }

        // 2. Resolve Specialist (User)
        // We need the User ID for the "Locked By" / "Assigned" logic in disposition
        // The UI sends "Leo" or "Kye". We need to map that to a User ID.
        // Or we use the CURRENT session user?
        // If "Kye" is logged in, he is booking.
        const userId = (session.user as any).id;

        // 3. Load Dependencies
        const twilio = await import("@/lib/twilio");
        const gCal = await import("@/lib/google-calendar");

        // 4. Trigger Disposition Logic (Handles Status, DB Meeting, Google Sync, SMS)
        // We set status to 'BOOKED'
        // We pass 'nextCallAt' as the START time of the meeting

        const result = await updateLeadDisposition(
            lead.id,
            userId,
            {
                status: 'BOOKED',
                nextCallAt: start, // This becomes Meeting Start
                notes: notes,
                contactData: { firstName: name.split(' ')[0], lastName: name.split(' ').slice(1).join(' '), email, phoneNumber: phone },
                timezone: '11', // Default to Sydney (11) as per CalendarPage default
                includeMeetLink: true, // Defaulting to TRUE as per user preference
                customMessage: `Hi ${name.split(' ')[0]}, confirming our demo for ${new Date(start).toLocaleString()}!`,
            },
            {
                sendSMS: twilio.sendSMS,
                createGoogleMeeting: gCal.createGoogleMeeting
            }
        );

        return NextResponse.json({ success: true, dispatch: result.dispatch });

    } catch (error: any) {
        console.error("Booking Error:", error);
        return NextResponse.json({ error: error.message || "Booking Failed" }, { status: 500 });
    }
}
