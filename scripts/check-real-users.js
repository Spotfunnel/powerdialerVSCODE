const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const emails = ['leo@getspotfunnel.com', 'spotfunnel@outlook.com'];
    for (const email of emails) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            console.log(`User: ${email}`);
            console.log(`- ID: ${user.id}`);
            console.log(`- Role: ${user.role}`);
            console.log(`- Has Password: ${!!user.passwordHash}`);
            console.log(`- Password Hash Prefix: ${user.passwordHash ? user.passwordHash.substring(0, 10) : 'N/A'}`);
        } else {
            console.log(`User: ${email} NOT FOUND`);
        }
    }
    await prisma.$disconnect();
}

run();
