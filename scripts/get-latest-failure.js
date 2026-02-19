
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const log = await prisma.auditLog.findFirst({
            where: { eventType: 'SMS_CRITICAL_FAILURE' },
            orderBy: { createdAt: 'desc' }
        });
        if (log) {
            console.log("FULL_PAYLOAD_START");
            console.log(log.payload);
            console.log("FULL_PAYLOAD_END");
        } else {
            console.log("No critical failures found.");
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
