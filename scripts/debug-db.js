
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const activity = await prisma.leadActivity.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { lead: true }
        });
        console.log('--- LATEST ACTIVITY ---');
        activity.forEach(a => {
            console.log(`[${a.createdAt.toISOString()}] [${a.type}] Lead: ${a.lead?.firstName} ${a.lead?.lastName} | ${a.content}`);
        });

        const messages = await prisma.message.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' }
        });
        console.log('\n--- LATEST SMS ---');
        messages.forEach(m => {
            console.log(`[${m.createdAt.toISOString()}] To: ${m.toNumber} | Status: ${m.status} | Body: ${m.body}`);
        });

        const meetings = await prisma.meeting.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { lead: true }
        });
        console.log('\n--- LATEST MEETINGS ---');
        meetings.forEach(meet => {
            console.log(`[${meet.createdAt.toISOString()}] Lead: ${meet.lead?.firstName} | Provider: ${meet.provider} | URL: ${meet.meetingUrl}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
