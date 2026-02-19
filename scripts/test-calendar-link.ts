
import { createGoogleMeeting } from '../src/lib/google-calendar';
import { prisma } from '../src/lib/prisma'; // Ensure we can load envs via prisma/app init if needed, usually just process.env

// We need to ensure dotenv is loaded if running independently
import 'dotenv/config';

async function main() {
    console.log("--- Testing Google Calendar Link Format ---");

    const start = new Date();
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    console.log("Creating Test Event...");
    try {
        // Use a dummy email that won't annoy anyone or use the user's own if available in env?
        // Let's use a fake one, it might bounce but API should respond.
        // Better: don't invite anyone to avoid spam, just create event.
        // But 'sendUpdates: all' works on attendees.

        const result = await createGoogleMeeting({
            title: "Test Event - Link Check",
            description: "Testing link format",
            start,
            end,
            attendees: [], // No attendees to avoid spam
            repName: "Test Rep",
            timeZone: "Australia/Sydney"
        });

        if (result) {
            console.log("\nEvent Created Successfully:");
            console.log("ID:", result.id);
            console.log("Meeting URL:", result.meetingUrl); // This is what we append to SMS
            console.log("Provider:", result.provider);

            if (result.meetingUrl && result.meetingUrl.length < 100 && result.meetingUrl.startsWith('https://')) {
                console.log("\n[PASS] URL is clean and valid.");
            } else {
                console.log("\n[WARN] URL might be verbose or invalid.");
            }
        } else {
            console.log("Failed to create event (likely auth missing locally).");
        }

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

main();
