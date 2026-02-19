
const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const prisma = new PrismaClient();

// Mock Env
process.env.NEXTAUTH_URL = "http://localhost:3000";

async function main() {
    const userEmail = "leo@getspotfunnel.com";
    console.log(`--- Debugging Flow for ${userEmail} ---`);

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error("User not found");

    // 1. Check Tokens
    const connection = await prisma.calendarConnection.findUnique({ where: { userId: user.id } });
    if (!connection) throw new Error("No CalendarConnection found");

    console.log("Tokens found:", {
        access: connection.accessToken ? "YES" : "NO",
        refresh: connection.refreshToken ? "YES" : "NO"
    });

    // 2. Check Timezone formatting
    const meetingTimeUTC = new Date("2026-02-13T08:00:00.000Z"); // 7pm Sydney (DST) is 08:00 UTC? 
    // Wait. 7pm Sydney = 19:00.
    // Sydney is GMT+11. 19 - 11 = 8.
    // So 08:00 UTC is correct for 7pm Sydney.

    const ianaTimeZone = 'Australia/Sydney';
    const regionLabel = 'Sydney, Australia';

    const formatted = meetingTimeUTC.toLocaleString('en-US', {
        timeZone: ianaTimeZone,
        dateStyle: 'full',
        timeStyle: 'short'
    });

    console.log(`\n--- Date Formatting Check ---`);
    console.log(`UTC Time: ${meetingTimeUTC.toISOString()}`);
    console.log(`Target Zone: ${ianaTimeZone}`);
    console.log(`Formatted: ${formatted}`);

    if (formatted.includes("8:00 AM")) {
        console.error("FAIL: Formatted string shows UTC time!");
    } else if (formatted.includes("7:00 PM") || formatted.includes("19:00")) {
        console.log("PASS: Formatted string shows Sydney time.");
    } else {
        console.log("WARN: Verify manually.");
    }

    // 3. Send Email Check
    console.log(`\n--- Sending Test Email ---`);

    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("Missing Google Env Vars");
    }

    const authClient = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    authClient.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const subject = "Debug Test: Logic Fix Verification";
    const body = `This is a test to verify Sent folder behavior.\nTime: ${formatted} (${regionLabel})`;

    const message = [
        `To: ${userEmail}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body
    ].join('\n');

    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage }
        });
        console.log("Email Sent ID:", res.data.id);
        console.log("PASS: Email API call succeeded.");
    } catch (e) {
        console.error("FAIL: Email sending failed:", e.message);
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
