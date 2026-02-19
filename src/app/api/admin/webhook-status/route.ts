import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";

export async function GET() {
    const lastPing = await prisma.webhookPing.findFirst({
        where: { source: "TWILIO" },
        orderBy: { receivedAt: "desc" }
    });

    return NextResponse.json({
        received: !!lastPing,
        lastReceivedAt: lastPing?.receivedAt || null,
        lastCallSid: (lastPing?.data as any)?.CallSid || null
    });
}
