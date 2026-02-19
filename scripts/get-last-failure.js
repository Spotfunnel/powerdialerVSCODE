
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- LATEST SMS FAILURES ---");
        const apiFailure = await prisma.auditLog.findFirst({
            where: { eventType: 'SMS_API_FAILURE' },
            orderBy: { createdAt: 'desc' }
        });

        const criticalFailure = await prisma.auditLog.findFirst({
            where: { eventType: 'SMS_CRITICAL_FAILURE' },
            orderBy: { createdAt: 'desc' }
        });

        if (apiFailure) {
            console.log('\n--- LATEST SMS_API_FAILURE ---');
            console.log('TIME:', apiFailure.createdAt.toISOString());
            console.log('PAYLOAD:', apiFailure.payload);
        }

        if (criticalFailure) {
            console.log('\n--- LATEST SMS_CRITICAL_FAILURE ---');
            console.log('TIME:', criticalFailure.createdAt.toISOString());
            console.log('PAYLOAD:', criticalFailure.payload);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
