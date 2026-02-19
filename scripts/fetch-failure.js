
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const log = await prisma.auditLog.findFirst({
            where: { eventType: 'SMS_CRITICAL_FAILURE' },
            orderBy: { createdAt: 'desc' }
        });
        if (log) {
            console.log("PAYLOAD_START");
            console.log(log.payload);
            console.log("PAYLOAD_END");
        } else {
            console.log("No failure logs found.");
        }
    } catch (e) {
        console.error("Query failed", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
