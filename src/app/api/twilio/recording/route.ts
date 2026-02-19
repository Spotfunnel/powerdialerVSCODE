import { NextResponse } from "next/server";
import { prismaDirect, withPrismaRetry } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const callSid = formData.get('CallSid') as string;
        const recordingUrl = formData.get('RecordingUrl') as string;
        const recordingSid = formData.get('RecordingSid') as string;

        console.log(`[Recording] Webhook hit. SID: ${callSid}, Recording: ${recordingUrl}`);

        if (!callSid || !recordingUrl) {
            return new NextResponse("Missing data", { status: 400 });
        }

        await withPrismaRetry(async () => {
            // Find the call by Twilio CallSid
            const call = await prismaDirect.call.findUnique({
                where: { twilioSid: callSid }
            });

            if (call) {
                await prismaDirect.call.update({
                    where: { id: call.id },
                    data: {
                        recordingUrl: recordingUrl,
                        status: 'voicemail', // Update status to indicate voicemail
                        outcome: 'Left Voicemail'
                    }
                });
                console.log(`[Recording] Saved recording for call ${call.id}`);
            } else {
                console.warn(`[Recording] No call found for SID ${callSid}`);
            }
        });

        return new NextResponse("OK", { status: 200 });
    } catch (e: any) {
        console.error("[Recording] Error saving recording:", e);
        return new NextResponse("Error", { status: 500 });
    }
}
