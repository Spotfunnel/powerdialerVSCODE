const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const leadCount = await prisma.lead.count({
            where: {
                NOT: {
                    phoneNumber: { startsWith: '+' }
                }
            }
        });
        const convCount = await prisma.conversation.count({
            where: {
                NOT: {
                    contactPhone: { startsWith: '+' }
                }
            }
        });
        console.log(`Leads left: ${leadCount}`);
        console.log(`Convs left: ${convCount}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
