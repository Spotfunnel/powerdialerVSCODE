
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findUser() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'spotfunnel@outlook.com' }
        });
        console.log("User Found:", user);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

findUser();
