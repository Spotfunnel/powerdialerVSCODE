import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/push";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get the latest subscription for this user
        const subscription = await (prisma as any).pushSubscription.findFirst({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' }
        });

        if (!subscription) {
            return NextResponse.json({ error: "No subscription found. Have you enabled notifications in the browser?" }, { status: 404 });
        }

        const payload = {
            title: "Test Notification",
            body: "If you see this, push notifications are working!",
            url: "/dialer"
        };

        const result = await sendPushNotification({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
            }
        }, payload);

        if (result.success) {
            return NextResponse.json({ success: true, message: "Notification sent!" });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error) {
        console.error("Push test error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
