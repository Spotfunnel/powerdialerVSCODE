
import { PrismaClient } from '@prisma/client';
import { getCredentials } from '../src/lib/twilio';
import twilio from 'twilio';

const prisma = new PrismaClient();

async function main() {
    console.log("--- Syncing Twilio Numbers (TS) ---");

    try {
        const creds = await getCredentials();
        console.log("Credentials retrieved successfully.");
        console.log(`SID: ${creds.sid.substring(0, 6)}...`);

        const client = twilio(creds.sid, creds.token);
        const incoming = await client.incomingPhoneNumbers.list({ limit: 100 });

        console.log(`Found ${incoming.length} numbers in Twilio.`);

        for (const num of incoming) {
            console.log(`Checking ${num.phoneNumber} (${num.friendlyName})...`);

            // Check if exists
            const exists = await prisma.numberPool.findUnique({
                where: { phoneNumber: num.phoneNumber }
            });

            if (!exists) {
                await prisma.numberPool.create({
                    data: {
                        phoneNumber: num.phoneNumber,
                        isActive: true,
                        dailyCount: 0
                    }
                });
                console.log("  -> Created in Pool");
            } else {
                console.log("  -> Already in Pool");
            }
        }

    } catch (e: any) {
        console.error("Sync Error:", e.message);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
