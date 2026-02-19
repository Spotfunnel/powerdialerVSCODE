
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRep() {
    try {
        console.log("Updating repPhoneNumber for spotfunnel@outlook.com...");
        const user = await prisma.user.update({
            where: { email: 'spotfunnel@outlook.com' },
            data: { repPhoneNumber: '+61477869317' }
        });
        console.log("Success:", user.repPhoneNumber);
    } catch (e) {
        if (e.code === 'P2025') {
            console.log("User not found, creating...");
            await prisma.user.create({
                data: {
                    email: 'spotfunnel@outlook.com',
                    name: 'SpotFunnel Owner',
                    passwordHash: '$2a$10$abcdefg', // Dummy hash
                    role: 'ADMIN',
                    repPhoneNumber: '+61477869317'
                }
            });
            console.log("Created user with correct phone.");
        } else {
            console.error("Error:", e);
        }
    } finally {
        await prisma.$disconnect();
    }
}

updateRep();
