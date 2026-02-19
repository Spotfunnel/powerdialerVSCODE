
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Cooling Down Number ---");

    // 1. Find the number ending in 731
    // First check NumberPool
    let poolNumber = await prisma.numberPool.findFirst({
        where: { phoneNumber: { endsWith: '731' } }
    });

    // If not in pool, check Settings fallback
    if (!poolNumber) {
        const settings = await prisma.settings.findFirst();
        if (settings?.twilioFromNumbers?.endsWith('731')) {
            console.log(`Found '731' number in Settings Fallback: ${settings.twilioFromNumbers}`);
            // Check if it exists in pool, if not create it
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
        console.log("Could not find a number ending in 731 in Pool or Settings.");
        // Fallback: Check most used number today from Calls
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const lastCall = await prisma.call.findFirst({
            where: { createdAt: { gte: todayStart } },
            orderBy: { createdAt: 'desc' },
            select: { fromNumber: true }
        });

        if (lastCall && lastCall.fromNumber) {
            console.log(`Most recent call used: ${lastCall.fromNumber}`);
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
                isActive: true // Ensure it's active so it can be used *after* cooldown, but logically current selection logic respects cooldown
            }
        });
        console.log(`SUCCESS: Number ${poolNumber.phoneNumber} is now on COOLDOWN until ${tomorrow.toLocaleString()}`);
    } else {
        console.error("FAILURE: Could not identify the number to cooldown.");
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
