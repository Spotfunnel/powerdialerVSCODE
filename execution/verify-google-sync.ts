import dotenv from 'dotenv';
import path from 'path';
import { createGoogleMeeting } from '../src/lib/google-calendar';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testGoogleSync() {
    console.log("--- Testing Google Calendar Sync ---");
    console.log("Client ID:", process.env.GOOGLE_CLIENT_ID ? "PRESENT" : "MISSING");
    console.log("Refresh Token:", process.env.GOOGLE_REFRESH_TOKEN ? "PRESENT" : "MISSING");

    try {
        const result = await createGoogleMeeting({
            title: "TEST: SpotFunnel End-to-End Sync",
            description: "Verification of live Google Calendar integration.",
            start: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            end: new Date(Date.now() + 90 * 60 * 1000), // 1.5 hours from now
            attendees: [{ email: 'leo@getspotfunnel.com' }],
            repName: 'Antigravity Verification'
        });

        console.log("Sync Status:", result.provider);
        console.log("Meeting URL:", result.meetingUrl);
        console.log("Event ID:", result.id);

        if (result.provider === 'GOOGLE') {
            console.log("\n✅ SUCCESS: Live Google Calendar synchronization is working!");
        } else {
            console.log("\n⚠️ WARNING: System fell back to simulation mode. Check credentials.");
        }
    } catch (error) {
        console.error("\n❌ FAILED: Synchronization error", error);
    }
}

testGoogleSync();
