import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const settings = await prisma.settings.findUnique({
            where: { id: "singleton" },
        });
        return NextResponse.json(settings || {});
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const data = await req.json();

        // Update or Create singleton settings with encryption where needed
        const settings = await prisma.settings.upsert({
            where: { id: "singleton" },
            update: {
                twilioAccountSid: data.twilioAccountSid,
                twilioAuthToken: data.twilioAuthToken ? encrypt(data.twilioAuthToken) : undefined,
                twilioAppSid: data.twilioAppSid,
                twilioFromNumbers: data.twilioFromNumbers,
                webhookBaseUrl: data.webhookBaseUrl,
                setupCompleted: true,
            },
            create: {
                id: "singleton",
                twilioAccountSid: data.twilioAccountSid || "",
                twilioAuthToken: data.twilioAuthToken ? encrypt(data.twilioAuthToken) : "",
                twilioAppSid: data.twilioAppSid || "",
                twilioFromNumbers: data.twilioFromNumbers || "",
                webhookBaseUrl: data.webhookBaseUrl || "",
                setupCompleted: true,
            },
        });

        // Also update the individual rep phone number if provided (for the current admin rep)
        if (data.repPhoneNumber) {
            await prisma.user.update({
                where: { id: (session.user as any).id },
                data: { repPhoneNumber: data.repPhoneNumber }
            });
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Settings update failed", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
