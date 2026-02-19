const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        // Fetch last 5 messages regardless of status to see what's happening
        const messages = await prisma.message.findMany({
            orderBy: {
                createdAt: 'desc'
            },
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
                createdAt: msg.createdAt,
                sid: msg.twilioMessageSid
            }))
        };

        console.log(JSON.stringify(result, null, 2));
        fs.writeFileSync('debug_output_v2.json', JSON.stringify(result, null, 2));

    } catch (e) {
        console.error("Error asking DB:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
