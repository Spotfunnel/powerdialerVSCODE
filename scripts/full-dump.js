
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const log = await prisma.auditLog.findFirst({
            where: { eventType: 'SMS_CRITICAL_FAILURE' },
            orderBy: { createdAt: 'desc' }
        });
        if (log) {
            console.log("JSON_DUMP_START");
            console.log(JSON.stringify(JSON.parse(log.payload), null, 2));
            console.log("JSON_DUMP_END");
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
