
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRepPhone() {
    try {
        const user = await prisma.user.update({
            where: { email: 'spotfunnel@outlook.com' },
            data: { repPhoneNumber: '+61477869317' } // E.164 format for 0477869317
        });
        console.log("Updated Rep Phone:", user);
    } catch (e) {
        console.error("Error updating phone:", e);
    } finally {
        await prisma.$disconnect();
    }
}

updateRepPhone();
