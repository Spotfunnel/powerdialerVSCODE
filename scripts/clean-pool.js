const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Get the Valid Number from Settings
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const validNumber = settings?.twilioFromNumbers?.split(',')[0].trim();

        if (!validNumber) {
            console.error("No valid number in settings to protect!");
            return;
        }

        console.log("Protecting Valid Number:", validNumber);

        // 2. Deactivate all others
        const updateResult = await prisma.numberPool.updateMany({
            where: {
                phoneNumber: { not: validNumber },
                isActive: true
            },
            data: {
                isActive: false
            }
        });

        console.log(`Deactivated ${updateResult.count} invalid numbers.`);

        // 3. Ensure Valid One is Active
        const ensureResult = await prisma.numberPool.update({
            where: { phoneNumber: validNumber },
            data: { isActive: true }
        });
        console.log(`Ensured ${validNumber} is Active.`);

    } catch (e) {
        console.error("Error cleaning pool:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
