
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- PRODUCTION DB TABLE COUNTS ---");
    try {
        const counts = {
            User: await prisma.user.count(),
            Lead: await prisma.lead.count(),
            NumberPool: await prisma.numberPool.count(),
            Settings: await prisma.settings.count(),
            AuditLog: await prisma.auditLog.count(),
            Message: await prisma.message.count(),
            Conversation: await prisma.conversation.count(),
        };
        console.log(JSON.stringify(counts, null, 2));

        const firstNum = await prisma.numberPool.findFirst();
        console.log("First NumberPool Entry:", JSON.stringify(firstNum));

        const activeNum = await prisma.numberPool.findFirst({ where: { isActive: true } });
        console.log("First Active NumberPool Entry:", JSON.stringify(activeNum));

    } catch (e) {
        console.error("Discovery failed", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
