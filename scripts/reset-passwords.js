const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
    console.log('--- Setting passwords to "Walkergewert" ---');
    const password = 'Walkergewert';
    const hash = await bcrypt.hash(password, 10);

    try {
        const users = ['leo@getspotfunnel.com', 'spotfunnel@outlook.com'];
        for (const email of users) {
            const user = await prisma.user.upsert({
                where: { email },
                update: { passwordHash: hash },
                create: {
                    email,
                    name: email.split('@')[0],
                    passwordHash: hash,
                    role: 'ADMIN'
                }
            });
            console.log(`✅ Reset password for ${email} to "${password}"`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
