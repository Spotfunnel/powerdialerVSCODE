
import { prisma } from "../src/lib/prisma";
import Twilio from "twilio";

async function removeUSNumber() {
    console.log("Removing US Number (+1)...");

    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.twilioAccountSid || !settings?.twilioApiKey || !settings?.twilioApiSecret) {
        console.error("Missing Twilio Credentials in DB");
        return;
    }

    const client = Twilio(settings.twilioApiKey, settings.twilioApiSecret, { accountSid: settings.twilioAccountSid });

    try {
        const numbers = await client.incomingPhoneNumbers.list();
        const usNumber = numbers.find(n => n.phoneNumber.startsWith('+1'));

        if (usNumber) {
            console.log(`Found US Number: ${usNumber.phoneNumber}. Releasing...`);
            await client.incomingPhoneNumbers(usNumber.sid).remove();
            console.log("Successfully released US number.");
        } else {
            console.log("No US number found.");
        }

        const remaining = await client.incomingPhoneNumbers.list();
        console.log(`Remaining numbers: ${remaining.length}`);
        remaining.forEach(n => console.log(` - ${n.phoneNumber}`));

    } catch (error) {
        console.error("Twilio API Error:", error);
    }
}

removeUSNumber();
