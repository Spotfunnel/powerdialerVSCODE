
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const log = await prisma.auditLog.findFirst({
            where: { eventType: 'SMS_CRITICAL_FAILURE' },
            orderBy: { createdAt: 'desc' }
        });
        if (log) {
            const p = JSON.parse(log.payload);
            console.log("--- LATEST CRITICAL FAILURE ---");
            console.log("Error:", p.error);
            console.log("From (Normalized):", p.cleanFrom);
            console.log("To (Normalized):", p.cleanTo);
            console.log("Lead ID:", p.leadId);
            console.log("User ID:", p.userId);
            console.log("-------------------------------");
        }

        const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        console.log("Settings TwilioFromNumbers:", settings?.twilioFromNumbers);

        const poolCount = await prisma.numberPool.count({ where: { isActive: true } });
        console.log("Active NumberPool Count:", poolCount);

    } finally {
        await prisma.$disconnect();
    }
}
main();
