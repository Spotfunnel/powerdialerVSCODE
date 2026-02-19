
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- NUMBER POOL AUDIT ---');
    try {
        const numbers = await prisma.numberPool.findMany({
            include: {
                owner: {
                    select: { email: true, name: true }
                }
            }
        });
        console.log(JSON.stringify(numbers, null, 2));

        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, repPhoneNumber: true }
        });
        console.log('--- USER LIST ---');
        console.log(JSON.stringify(users, null, 2));

    } catch (e) {
        console.error('Audit Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
