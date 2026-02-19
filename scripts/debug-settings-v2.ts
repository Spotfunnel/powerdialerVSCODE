import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const allSettings = await prisma.settings.findMany();
    console.log(`Found ${allSettings.length} settings records.`);
    if (allSettings.length > 0) {
        console.log("Settings keys:", Object.keys(allSettings[0]));
        console.log("ID of first setting:", allSettings[0].id);
        console.log("Account SID present:", !!allSettings[0].twilioAccountSid);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
