
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    try {
        const log = await prisma.auditLog.findFirst({
            where: { eventType: 'SMS_API_FAILURE' },
            orderBy: { createdAt: 'desc' }
        });
        if (log) {
            fs.writeFileSync('last_sms_failure_full.json', JSON.stringify(JSON.parse(log.payload), null, 2));
            console.log('Saved to last_sms_failure_full.json');
        } else {
            console.log('No failure logs found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
