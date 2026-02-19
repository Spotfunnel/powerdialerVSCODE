
import { prisma } from "../src/lib/prisma";
import 'dotenv/config';
import { encrypt } from "../src/lib/encryption";

async function main() {
    console.log("Seeding Settings...");

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    const appSid = process.env.TWILIO_APP_SID;
    const encKey = process.env.ENCRYPTION_KEY;

    if (!sid || !token || !encKey) {
        console.error("Missing Twilio Env Vars or ENCRYPTION_KEY");
        process.exit(1);
    }

    const encryptedToken = encrypt(token);
    console.log("Encrypted Token length:", encryptedToken.length);

    const settings = await prisma.settings.upsert({
        where: { id: "singleton" },
        update: {
            twilioAccountSid: sid,
            twilioAuthToken: encryptedToken,
            twilioFromNumbers: from,
            twilioAppSid: appSid,
            setupCompleted: true
        },
        create: {
            id: "singleton",
            twilioAccountSid: sid,
            twilioAuthToken: encryptedToken,
            twilioFromNumbers: from,
            twilioAppSid: appSid,
            setupCompleted: true,
            updatedAt: new Date()
        }
    });

    console.log("Settings seeded:", settings);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
