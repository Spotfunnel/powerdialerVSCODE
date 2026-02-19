const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const failedMessages = await prisma.message.findMany({
            where: {
                status: {
                    in: ['FAILED', 'UNDELIVERED']
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 5
        });

        const result = {
            count: failedMessages.length,
            messages: failedMessages.map(msg => ({
                id: msg.id,
                to: msg.toNumber,
                from: msg.fromNumber,
                status: msg.status,
                errorCode: msg.errorCode,
                errorMessage: msg.errorMessage,
                createdAt: msg.createdAt
            }))
        };

        fs.writeFileSync('debug_output.json', JSON.stringify(result, null, 2));

    } catch (e) {
        console.error("Error querying messages:", e);
        fs.writeFileSync('debug_output.json', JSON.stringify({ error: e.message }));
    } finally {
        await prisma.$disconnect();
    }
}

main();
