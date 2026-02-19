import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        console.log("[Token] Starting token generation...");

        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            console.error("[Token] No session found or user ID missing");
            return NextResponse.json({
                error: 'Unauthorized',
                details: !session ? "No session found" : "User ID missing from session"
            }, { status: 401 });
        }

        const settings = await withPrismaRetry(() =>
            prisma.settings.findUnique({
                where: { id: 'singleton' }
            }),
            3, 1000, true
        );

        if (!settings) {
            console.error("[Token] Settings not initialized in DB");
            return NextResponse.json({ error: 'Settings not initialized in database' }, { status: 500 });
        }

        const accountSid = settings.twilioAccountSid;
        // Decrypt keys if they are stored encrypted
        let apiKey = (settings as any).twilioApiKey;
        let apiSecret = (settings as any).twilioApiSecret;

        try {
            if (apiKey && apiKey.length > 50) apiKey = decrypt(apiKey);
            if (apiSecret && apiSecret.length > 50) apiSecret = decrypt(apiSecret);
        } catch (error: any) {
            console.error("[Token] Decryption failed:", error);
            return NextResponse.json({
                error: 'Twilio Credential Decryption Failed',
                details: error.message,
                stack: error.stack
            }, { status: 500 });
        }

        const twimlAppSid = settings.twilioAppSid;

        if (!accountSid || !twimlAppSid || !apiKey || !apiSecret) {
            const missing = [];
            if (!accountSid) missing.push("AccountSid");
            if (!twimlAppSid) missing.push("AppSid");
            if (!apiKey) missing.push("ApiKey");
            if (!apiSecret) missing.push("ApiSecret");

            console.error("[Token] Incomplete Configuration. Missing:", missing.join(", "));

            return NextResponse.json({
                error: 'Twilio Configuration Incomplete: ' + missing.join(", ")
            }, { status: 500 });
        }

        const identity = session.user.id;
        console.log(`[Token] Generating for identity: ${identity} (${session.user.email})`);

        const AccessToken = twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;

        // Create an Access Token
        const token = new AccessToken(
            accountSid!,
            apiKey!,
            apiSecret!,
            { identity }
        );

        // Create a Voice Grant
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: twimlAppSid,
            incomingAllow: true, // Allow incoming calls
        });

        // Add the grant to the token
        token.addGrant(voiceGrant);

        // Serialize the token to a JWT string
        const jwt = token.toJwt();
        console.log("[Token] Token generated successfully");

        return NextResponse.json({ token: jwt });
    } catch (error: any) {
        console.error("Token Generation Error:", error);
        return NextResponse.json({
            error: 'Failed to generate token',
            details: error.message,
            stack: error.stack,
            env: {
                HAS_DB_URL: !!process.env.DATABASE_URL,
                HAS_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
                NODE_ENV: process.env.NODE_ENV
            }
        }, { status: 500 });
    }
}
export async function GET(req: Request) {
    return POST(req);
}
