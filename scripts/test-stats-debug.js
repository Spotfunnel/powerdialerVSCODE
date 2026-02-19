const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Get the first user to test with
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log("No users found.");
            return;
        }
        console.log(`Testing stats for user: ${user.email} (${user.id})`);

        // 2. mimic the API logic
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        console.log("Start of Day (Local/Server):", startOfDay.toISOString());

        const calls = await prisma.leadActivity.count({
            where: {
                userId: user.id,
                type: 'CALL',
                createdAt: {
                    gte: startOfDay
                }
            }
        });

        console.log(`Calls found since ${startOfDay.toISOString()}: ${calls}`);

        // 3. Check TOTAL calls to see if any exist at all
        const totalCalls = await prisma.leadActivity.count({
            where: {
                userId: user.id,
                type: 'CALL'
            }
        });
        console.log(`Total lifetime calls for user: ${totalCalls}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
