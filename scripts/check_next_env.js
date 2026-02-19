
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Manually load .env files in priority order
const envFiles = ['.env.local', '.env'];
for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`Loading ${file}...`);
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
}

async function main() {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

    if (!REFRESH_TOKEN) {
        console.log("No System Refresh Token found.");
        return;
    }

    console.log("Refresh Token found (starts with):", REFRESH_TOKEN.substring(0, 10) + "...");

    const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET
    );

    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    const oauth2 = google.oauth2({
        auth: oauth2Client,
        version: 'v2'
    });

    try {
        const { data } = await oauth2.userinfo.get();
        console.log("\n--- System Account Details ---");
        console.log("Email:", data.email);
        console.log("Name:", data.name);
    } catch (error) {
        console.error("Failed to fetch info:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
    }
}

main().catch(console.error);
