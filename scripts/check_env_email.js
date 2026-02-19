
require('dotenv').config();
const { google } = require('googleapis');

async function main() {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

    if (!REFRESH_TOKEN) {
        console.log("No System Refresh Token found in environment.");
        return;
    }

    const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    // Use oauth2 API v2 specifically
    const oauth2 = google.oauth2({
        auth: oauth2Client,
        version: 'v2'
    });

    try {
        const { data } = await oauth2.userinfo.get();
        console.log("System Account Email:", data.email);
        console.log("System Account Name:", data.name);
    } catch (error) {
        console.error("Failed to fetch system account info:", error.message);
    }
}

main().catch(console.error);
