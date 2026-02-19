const { google } = require('googleapis');
require('dotenv').config({ path: '.env' });

async function main() {
    console.log("--- Checking Recent Calendar Events ---");

    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: oneHourAgo.toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
    });

    const events = res.data.items;
    if (events && events.length) {
        console.log(`Found ${events.length} recent events:`);
        events.forEach((event, i) => {
            console.log(`\n[${i + 1}] Summary: ${event.summary}`);
            console.log(`    Link: ${event.hangoutLink || event.htmlLink}`);
            console.log(`    Created: ${event.created}`);
            if (event.attendees) {
                console.log(`    Attendees:`);
                event.attendees.forEach(a => {
                    console.log(`      - ${a.email} (Status: ${a.responseStatus})`);
                });
            } else {
                console.log(`    Attendees: NONE`);
            }
        });
    } else {
        console.log('No recent events found.');
    }
}

main().catch(console.error);
