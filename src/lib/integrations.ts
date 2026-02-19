import twilio from "twilio";

export async function verifyTwilio(sid: string, token: string) {
    try {
        const client = twilio(sid, token);
        await client.api.v2010.account.fetch();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to connect to Twilio" };
    }
}
