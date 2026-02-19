const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const output = {};

    try {
        // 1. Check Settings Update Time
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        output.settings = {
            updatedAt: settings?.updatedAt,
            hasSid: !!settings?.twilioAccountSid,
            hasToken: !!settings?.twilioAuthToken,
            twilioFromNumbers: settings?.twilioFromNumbers
        };

        // 2. Check Latest Messages
        const messages = await prisma.message.findMany({
            orderBy: { createdAt: 'desc' },
            take: 3
        });

        output.latestMessages = messages.map(m => ({
            id: m.id,
            createdAt: m.createdAt,
            status: m.status,
            error: m.errorMessage
        }));

        fs.writeFileSync('status_output.json', JSON.stringify(output, null, 2));

    } catch (e) {
        console.error("Error:", e);
        fs.writeFileSync('status_output.json', JSON.stringify({ error: e.message }));
    } finally {
        await prisma.$disconnect();
    }
}

main();
