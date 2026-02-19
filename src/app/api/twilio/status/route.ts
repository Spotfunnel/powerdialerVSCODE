import { NextResponse } from 'next/server';
import { validateTwilioRequest } from "@/lib/twilio";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const params = Object.fromEntries(formData.entries());
        const url = req.url;

        // Security Audit: Validate Twilio Signature
        if (process.env.NODE_ENV === "production") {
            const isValid = await validateTwilioRequest(req, url, params);
            if (!isValid) {
                console.error("[Security] INVALID TWILIO SIGNATURE on status route.");
                return new NextResponse("Unauthorized", { status: 401 });
            }
        }

        const callSid = formData.get("CallSid") as string;
        const callStatus = formData.get("CallStatus") as string;
        const sequence = formData.get("SequenceNumber") as string;

        // Idempotency check: Don't process the same status update twice
        // Twilio sends sequence numbers which we could use, but status + sid is often enough for basic state.
        const existingCall = await prisma.call.findUnique({ where: { twilioSid: callSid } });

        if (existingCall && existingCall.status === callStatus) {
            console.log(`[Status] Skipping redundant update for ${callSid}: ${callStatus}`);
            return new Response("OK (Skipped)");
        }

        const duration = formData.get("CallDuration") as string;
        const recordingUrl = formData.get("RecordingUrl") as string;

        if (!callSid) {
            return new Response("Missing CallSid", { status: 400 });
        }

        // State Transition Logic: Prevent regressions
        const statusPriority: Record<string, number> = {
            'queued': 1,
            'initiated': 2,
            'ringing': 3,
            'answered': 4,
            'in-progress': 5,
            'completed': 6,
            'busy': 6,
            'failed': 6,
            'no-answer': 6,
            'canceled': 6
        };

        const currentPriority = existingCall ? statusPriority[existingCall.status?.toLowerCase() || ''] || 0 : 0;
        const newPriority = statusPriority[callStatus.toLowerCase()] || 0;

        if (newPriority < currentPriority && currentPriority >= 6) {
            console.log(`[Status] Rejecting status regression for ${callSid}: ${existingCall?.status} -> ${callStatus}`);
            return new Response("OK (Regression Blocked)");
        }

        // Update call status in DB
        await prisma.call.update({
            where: { twilioSid: callSid },
            data: {
                status: callStatus,
                duration: duration ? parseInt(duration) : undefined,
                recordingUrl: recordingUrl || undefined,
            },
        });

        // If call is completed, we might trigger follow-up logic
        // such as updating lead stats or native actions
        if (callStatus === "completed" && existingCall?.leadId) {
            try {
                await (prisma as any).leadActivity.create({
                    data: {
                        leadId: existingCall.leadId,
                        type: "CALL",
                        content: `Call completed. Duration: ${duration || 0}s. Status: ${callStatus}`,
                        userId: existingCall.userId
                    }
                });
            } catch (activityError) {
                console.error("[Status] Failed to log activity:", activityError);
            }
        }

        return new Response("OK");
    } catch (error) {
        console.error("Twilio status webhook failed:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
