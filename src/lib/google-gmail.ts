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



export async function sendGmailConfirmation(details: {
    to: string;
    from?: string; // e.g. "Kye Walker <kye@getspotfunnel.com>"
    subject: string;
    body: string;
}, tokens?: { accessToken: string; refreshToken?: string | null }) {
    if ((!CLIENT_ID || !REFRESH_TOKEN) && !tokens) {
        console.warn("Gmail Credentials Missing. Skipping Email Dispatch.");
        return null;
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

    const gmail = google.gmail({ version: 'v1', auth: authClient });


    try {
        const utf8Subject = `=?utf-8?B?${Buffer.from(details.subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${details.to}`,
            ...(details.from ? [
                `From: ${details.from}`,
                `Reply-To: ${details.from}`
            ] : []),
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            details.body,
        ];
        const message = messageParts.join('\r\n');

        console.log(`[Gmail API] Dispatching message to: ${details.to}`);
        if (details.from) console.log(`[Gmail API] Using custom From header: ${details.from}`);

        // Debug: Log first 100 chars of raw message to verify headers
        console.log(`[Gmail API] Raw headers preview: ${message.substring(0, 150).replace(/\r\n/g, '[CRLF]')}`);

        // The body needs to be base64url encoded.
        const encodedEmail = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Failed to send Gmail confirmation:", error);
        throw error;
    }
}
