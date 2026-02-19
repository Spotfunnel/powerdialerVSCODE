const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function verifyCredentials() {
    console.log("--- Standalone JS Google Credential Verification ---");

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.error("❌ Missing credentials in .env");
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        "http://localhost:3000/api/auth/callback/google"
    );

    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
        console.log("Attempting to insert test event...");
        const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: "SpotFunnel Credential Verification (JS)",
                description: "This is a test event to verify the Google Calendar API credentials.",
                start: { dateTime: new Date(Date.now() + 3600000).toISOString() },
                end: { dateTime: new Date(Date.now() + 7200000).toISOString() },
                conferenceData: {
                    createRequest: {
                        requestId: `verify-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
            },
            conferenceDataVersion: 1,
        });

        console.log("✅ SUCCESS!");
        console.log("Event ID:", event.data.id);
        console.log("Meeting Link:", event.data.hangoutLink);

        // Cleanup: Delete the test event
        console.log("Cleaning up test event...");
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: event.data.id
        });
        console.log("✅ Cleanup successful.");

    } catch (error) {
        console.error("❌ FAILED!");
        console.error("Error Message:", error.message);
        if (error.response) {
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

verifyCredentials();
