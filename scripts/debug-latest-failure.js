const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        // Look for messages created in the last 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const messages = await prisma.message.findMany({
            where: {
                createdAt: { gte: tenMinutesAgo }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        const result = {
            count: messages.length,
            messages: messages.map(msg => ({
                id: msg.id,
                to: msg.toNumber,
                from: msg.fromNumber,
                status: msg.status,
                errorCode: msg.errorCode,
                errorMessage: msg.errorMessage,
                createdAt: msg.createdAt
            }))
        };

        fs.writeFileSync('debug_latest.json', JSON.stringify(result, null, 2));

    } catch (e) {
        console.error("Error:", e);
        fs.writeFileSync('debug_latest.json', JSON.stringify({ error: e.message }));
    } finally {
        await prisma.$disconnect();
    }
}

main();
