import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Proxy endpoint for Twilio recording playback.
 * Twilio recording URLs require HTTP Basic Auth, which browsers can't
 * send from an <audio> element. This fetches with credentials and streams back.
 */
export async function GET(req: Request, { params }: { params: { callId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const call = await prisma.call.findUnique({
            where: { id: params.callId },
            select: { recordingUrl: true }
        });

        if (!call?.recordingUrl) {
            return new NextResponse("Recording not found", { status: 404 });
        }

        // Twilio recording URLs need .mp3 appended for audio format
        const audioUrl = call.recordingUrl.endsWith('.mp3')
            ? call.recordingUrl
            : `${call.recordingUrl}.mp3`;

        const accountSid = process.env.TWILIO_ACCOUNT_SID!;
        const authToken = process.env.TWILIO_AUTH_TOKEN!;
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const response = await fetch(audioUrl, {
            headers: {
                'Authorization': `Basic ${credentials}`
            }
        });

        if (!response.ok) {
            console.error(`[Recording Proxy] Twilio returned ${response.status} for ${audioUrl}`);
            return new NextResponse("Recording unavailable", { status: 502 });
        }

        const audioBuffer = await response.arrayBuffer();

        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
                'Cache-Control': 'private, max-age=3600',
            }
        });
    } catch (error: any) {
        console.error("[Recording Proxy] Error:", error);
        return new NextResponse("Server Error", { status: 500 });
    }
}
