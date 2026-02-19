const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("--- RECONCILING USER PSTN FALLBACKS ---");

    const users = await prisma.user.findMany({
        include: { phones: { where: { isActive: true } } }
    });

    for (const user of users) {
        if (!user.repPhoneNumber) {
            const fallback = user.phones[0]?.phoneNumber || "+61400000000";
            console.log(`Updating ${user.email}: Setting repPhoneNumber to ${fallback}`);
            await prisma.user.update({
                where: { id: user.id },
                data: { repPhoneNumber: fallback }
            });
        } else {
            console.log(`User ${user.email} already has repPhoneNumber: ${user.repPhoneNumber}`);
        }
    }

    console.log("--- DONE ---");
}

run().catch(console.error).finally(() => prisma.$disconnect());
