
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- Number Pool Audit ---");

    // Get Settings
    const settings = await prisma.settings.findFirst();
    console.log(`Settings Default Number: ${settings?.twilioFromNumbers || 'N/A'}`);

    // Get Pool
    const numbers = await prisma.numberPool.findMany({
        orderBy: { phoneNumber: 'asc' }
    });

    console.log(`\nPool Numbers (${numbers.length}):`);
    for (const n of numbers) {
        let status = [];
        if (!n.isActive) status.push("INACTIVE");
        if (n.cooldownUntil && n.cooldownUntil > new Date()) status.push(`COOLDOWN until ${n.cooldownUntil.toLocaleTimeString()}`);
        if (n.phoneNumber === settings?.twilioFromNumbers) status.push("MATCHES SETTINGS (MAIN)");

        console.log(` - ${n.phoneNumber} [${status.join(', ') || 'Ready'}]`);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
