import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/integrations/google/callback`;

    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: "Missing Google Credentials in .env" }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    const scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: "offline", // Crucial for Refresh Token
        scope: scopes,
        include_granted_scopes: true,
        prompt: "consent" // Force consent to ensure we get a Refresh Token
    });

    return NextResponse.redirect(authorizationUrl);
}
