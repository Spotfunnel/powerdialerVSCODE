import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    process.env.NEXTAUTH_URL + '/api/auth/callback/google'
);

if (REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
}



export async function createGoogleMeeting(details: {
    title: string;
    description: string;
    start: Date;
    end: Date;
    attendees: { email: string }[];
    repName: string;
    timeZone?: string;
    location?: string;
}, tokens?: { accessToken: string; refreshToken?: string | null }) {
    if ((!CLIENT_ID || !REFRESH_TOKEN) && !tokens) {
        console.warn("Google Calendar Credentials Missing. Skipping Calendar Event Creation.");
        return null; // Return null effectively means "failed to create external event"
    }

    const authClient = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    if (tokens) {
        authClient.setCredentials({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken || undefined
        });
    } else if (REFRESH_TOKEN) {
        authClient.setCredentials({ refresh_token: REFRESH_TOKEN });
    }

    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {

        console.log(`[GCal] Inserting event: ${details.title} for ${details.attendees.map(a => a.email).join(', ')}`);

        const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: details.title,
                location: details.location || 'Australia',
                description: `${details.description}\n\nAssigned Specialist: ${details.repName}`,
                start: { dateTime: details.start.toISOString(), timeZone: details.timeZone },
                end: { dateTime: details.end.toISOString(), timeZone: details.timeZone },
                attendees: details.attendees,
                conferenceData: {
                    createRequest: {
                        requestId: `meet-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 24 * 60 },
                        { method: 'popup', minutes: 30 },
                    ],
                },
            },
            conferenceDataVersion: 1,
            sendUpdates: 'all',
        } as any);

        console.log(`[GCal] Success! Event ID: ${event.data.id}, Meet: ${event.data.hangoutLink}`);

        return {
            id: event.data.id,
            meetingUrl: event.data.hangoutLink || event.data.htmlLink,
            calendarUrl: event.data.htmlLink,
            provider: 'GOOGLE'
        };
    } catch (error) {
        console.error("Failed to create Google Meeting:", error);
        throw error;
    }
}

export async function getOccupiedSlots(start: Date, end: Date) {
    if (!CLIENT_ID || !REFRESH_TOKEN) {
        console.warn("Google Calendar Credentials Missing. Returning empty slots (Simulation).");
        return [];
    }

    const authClient = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );
    authClient.setCredentials({ refresh_token: REFRESH_TOKEN });
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        return response.data.items || [];
    } catch (error) {
        console.error("Failed to fetch Google Calendar events:", error);
        return [];
    }
}
