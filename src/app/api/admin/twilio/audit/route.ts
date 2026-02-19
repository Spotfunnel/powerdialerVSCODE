import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { getCredentials } from '@/lib/twilio';

export async function GET() {
    return handleAudit();
}

export async function POST() {
    return handleAudit();
}

async function handleAudit() {
    try {
        console.log("[Audit API] Starting Audit...");
        let creds;
        try {
            creds = await getCredentials();
        } catch (e: any) {
            console.error("[Audit API] Credentials Error:", e);
            return NextResponse.json({
                error: "Credentials Error",
                details: e.message,
                hint: e.message.includes("authenticate data") ? "Encryption Key mismatch. Re-save Twilio settings in Admin." : "Check Twilio settings."
            }, { status: 400 });
        }

        if (!creds.sid || !creds.token) {
            return NextResponse.json({ error: "Twilio credentials not found in database settings." }, { status: 400 });
        }

        const client = twilio(creds.sid, creds.token);

        // Fetch numbers from Twilio
        const incomingNumbers = await client.incomingPhoneNumbers.list().catch(e => {
            console.error("[Audit API] Twilio List Error:", e);
            throw new Error(`Twilio API Error: ${e.message}`);
        });

        // Fetch our DB NumberPool for cross-referencing
        const pool = await prisma.numberPool.findMany({
            include: { owner: { select: { email: true, id: true } } }
        }).catch(e => {
            console.error("[Audit API] DB Pool Error:", e);
            throw new Error(`Database Error: ${e.message}`);
        });

        // Fetch Base URL from database settings preferably
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const baseUrl = (settings?.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || "").trim();
        const expectedUrl = `${baseUrl}/api/twilio/inbound`.replace(/\/+$/, ""); // Clean trailing slash if any

        const auditResults = incomingNumbers.map(tn => {
            const dbMatch = pool.find(n => n.phoneNumber === tn.phoneNumber);
            const cleanVoiceUrl = (tn.voiceUrl || "").replace(/\/+$/, "");
            const isCorrect = cleanVoiceUrl === expectedUrl && tn.voiceMethod === 'POST';

            return {
                phoneNumber: tn.phoneNumber,
                sid: tn.sid,
                voiceUrl: tn.voiceUrl || "NOT_SET",
                voiceMethod: tn.voiceMethod || "NOT_SET",
                friendlyName: tn.friendlyName,
                dbOwner: dbMatch?.owner?.email || 'None',
                dbOwnerId: dbMatch?.owner?.id || null,
                isCorrectUrl: isCorrect,
                expectedUrl
            };
        });

        // Get Presence for Identity Match check
        const users = await prisma.user.findMany({
            select: { id: true, email: true, lastSeenAt: true }
        }).catch(() => []);

        const presence = users.map(u => ({
            id: u.id,
            email: u.email,
            isOnline: u.lastSeenAt && (new Date().getTime() - new Date(u.lastSeenAt).getTime() < 60000)
        }));

        return NextResponse.json({
            meta: {
                standardIdentityFormat: "userId (CUID)",
                baseUrl: baseUrl,
                verifiedAt: new Date().toISOString()
            },
            audit: auditResults,
            presence
        });

    } catch (error: any) {
        console.error("[Audit API] Error:", error);
        return NextResponse.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
