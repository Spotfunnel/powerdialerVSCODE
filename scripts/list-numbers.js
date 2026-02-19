const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const numbers = await prisma.numberPool.findMany({
            where: { isActive: true },
            take: 2,
            select: { phoneNumber: true }
        });
        console.log('--- ACTIVE NUMBERS ---');
        console.log(numbers);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
