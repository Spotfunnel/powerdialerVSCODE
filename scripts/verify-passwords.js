const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
    const password = 'Walkergewert0!';
    const alternatePassword = 'Walkergewert01';

    try {
        const users = await prisma.user.findMany();
        console.log(`Checking password for ${users.length} users:`);

        for (const user of users) {
            const matches = await bcrypt.compare(password, user.passwordHash);
            const altMatches = await bcrypt.compare(alternatePassword, user.passwordHash);

            console.log(`User: ${user.email}`);
            console.log(`  - Password "Walkergewert0!" matches: ${matches}`);
            console.log(`  - Password "Walkergewert01" matches: ${altMatches}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
