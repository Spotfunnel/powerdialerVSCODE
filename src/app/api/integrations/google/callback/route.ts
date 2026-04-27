import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/integrations/google/callback`;

    if (error) {
        return NextResponse.redirect(`${baseUrl}/profile?error=google_auth_failed`);
    }

    if (!code) {
        return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // 1. Authenticate User
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
        // Fallback: If no session (maybe they lost it during redirect loop?), we can't save.
        // But usually session persists.
        return NextResponse.redirect(`${baseUrl}/login?error=session_expired`);
    }

    const userId = session.user.id; // Ensure User ID is string

    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        // 2. Exchange Code for Tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // 2b. Fetch the actual Google account email so we can display it
        //     (prevents the "connected as the wrong account" confusion)
        let googleEmail: string | undefined;
        let googleName: string | undefined;
        try {
            const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
            const userinfo = await oauth2.userinfo.get();
            googleEmail = userinfo.data.email || undefined;
            googleName = userinfo.data.name || undefined;
        } catch (e) {
            console.warn("[Google Integration] Failed to fetch userinfo:", (e as Error).message);
        }

        // 3. Save to Database
        await prisma.calendarConnection.upsert({
            where: { userId: userId },
            update: {
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token || undefined, // Only update if present (Google sometimes omits on re-auth)
                expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
                senderEmail: googleEmail || undefined,
                senderName: googleName || undefined,
                updatedAt: new Date()
            },
            create: {
                userId: userId,
                provider: "google",
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token,
                expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
                senderEmail: googleEmail,
                senderName: googleName
            }
        });

        console.log(`[Google Integration] User ${session.user.email} (${userId}) connected Google account: ${googleEmail}`);

        return NextResponse.redirect(`${baseUrl}/profile?success=google_connected&google=${encodeURIComponent(googleEmail || '')}`);
    } catch (err) {
        console.error("[Google Integration] Auth Callback Failed:", err);
        return NextResponse.redirect(`${baseUrl}/profile?error=internal_server_error`);
    }
}
