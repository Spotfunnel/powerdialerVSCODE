
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function check() {
    try {
        const fiveMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

        const activity = await prisma.leadActivity.findMany({
            where: { createdAt: { gte: fiveMinsAgo } },
            orderBy: { createdAt: 'desc' },
            include: { lead: true, user: true }
        });

        const meetings = await prisma.meeting.findMany({
            where: { createdAt: { gte: fiveMinsAgo } },
            orderBy: { createdAt: 'desc' },
            include: { lead: true }
        });

        const messages = await prisma.message.findMany({
            where: { createdAt: { gte: fiveMinsAgo } },
            orderBy: { createdAt: 'desc' }
        });

        const report = {
            activity,
            meetings,
            messages
        };

        fs.writeFileSync('debug_report.json', JSON.stringify(report, null, 2));
        console.log('Report written to debug_report.json');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
