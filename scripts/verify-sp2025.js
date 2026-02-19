const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
    console.log('--- Password Verification Start ---');
    const users = ['leo@getspotfunnel.com', 'spotfunnel@outlook.com'];
    const targetPassword = 'SpotFunnel2025!';

    try {
        for (const email of users) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                console.log(`❌ User ${email} not found`);
                continue;
            }

            const match = await bcrypt.compare(targetPassword, user.passwordHash);
            if (match) {
                console.log(`✅ ${email}: Password MATCHES "SpotFunnel2025!"`);
            } else {
                console.log(`❌ ${email}: Password DOES NOT MATCH "SpotFunnel2025!"`);
            }
        }
    } catch (e) {
        console.error('Error during verification:', e);
    } finally {
        await prisma.$disconnect();
        console.log('--- Password Verification End ---');
    }
}

run();
