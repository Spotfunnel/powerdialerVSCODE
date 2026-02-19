import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initiateBridgeCall } from "@/lib/twilio-service";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { leadId } = await req.json();
        if (!leadId) {
            return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
        }

        const userId = (session.user as any).id;
        const callSid = await initiateBridgeCall(leadId, userId);

        return NextResponse.json({ success: true, callSid });
    } catch (error: any) {
        console.error("Call initiation failed:", error);
        return NextResponse.json({
            error: error.message || "Failed to initiate call"
        }, { status: 500 });
    }
}
