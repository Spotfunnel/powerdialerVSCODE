import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    const formData = await req.formData();
    const senderName = formData.get("senderName") as string | null;
    const senderEmail = formData.get("senderEmail") as string | null;

    try {
        await prisma.calendarConnection.update({
            where: { userId: session.user.id },
            data: {
                senderName: senderName || null,
                senderEmail: senderEmail || null,
                updatedAt: new Date()
            }
        });

        // Redirect back to profile with success
        return NextResponse.redirect(new URL("/profile?success=settings_saved", req.url));
    } catch (error) {
        console.error("Failed to save alias settings:", error);
        return NextResponse.redirect(new URL("/profile?error=save_failed", req.url));
    }
}
