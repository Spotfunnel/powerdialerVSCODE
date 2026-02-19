
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const suffix = process.argv[2];

if (!suffix) {
    console.error("Please provide a number suffix (e.g. 223)");
    process.exit(1);
}

async function main() {
    console.log(`--- Cooling Down Number ending in '${suffix}' ---`);

    // 1. Find the number
    let poolNumber = await prisma.numberPool.findFirst({
        where: { phoneNumber: { endsWith: suffix } }
    });

    // If not in pool, check Settings fallback
    if (!poolNumber) {
        const settings = await prisma.settings.findFirst();
        if (settings?.twilioFromNumbers?.endsWith(suffix)) {
            console.log(`Found '${suffix}' in Settings Fallback: ${settings.twilioFromNumbers}`);
            poolNumber = await prisma.numberPool.findUnique({
                where: { phoneNumber: settings.twilioFromNumbers }
            });

            if (!poolNumber) {
                console.log("Number not in pool, creating entry...");
                poolNumber = await prisma.numberPool.create({
                    data: {
                        phoneNumber: settings.twilioFromNumbers,
                        isActive: true
                    }
                });
            }
        }
    }

    if (!poolNumber) {
        // Fallback: Check Calls table for a number ending with this suffix
        console.log("Checking recent calls...");
        const lastCall = await prisma.call.findFirst({
            where: { fromNumber: { endsWith: suffix } },
            orderBy: { createdAt: 'desc' }
        });

        if (lastCall && lastCall.fromNumber) {
            console.log(`Found recent call usage: ${lastCall.fromNumber}`);
            poolNumber = await prisma.numberPool.upsert({
                where: { phoneNumber: lastCall.fromNumber },
                update: {},
                create: { phoneNumber: lastCall.fromNumber, isActive: true }
            });
        }
    }

    if (poolNumber) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow

        await prisma.numberPool.update({
            where: { id: poolNumber.id },
            data: {
                cooldownUntil: tomorrow,
                isActive: true
            }
        });
        console.log(`SUCCESS: Number ${poolNumber.phoneNumber} is now on COOLDOWN until ${tomorrow.toLocaleString()}`);
    } else {
        console.error(`FAILURE: Could not find any number ending in '${suffix}'.`);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
