const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        if (logs.length > 0) {
            console.log(`Found ${logs.length} recent logs.`);
            const formatted = logs.map(log => ({
                timestamp: log.createdAt,
                type: log.eventType,
                payload: log.payload ? JSON.parse(log.payload) : null
            }));

            console.log(JSON.stringify(formatted, null, 2));
            fs.writeFileSync('audit_output.json', JSON.stringify(formatted, null, 2));
        } else {
            console.log("No logs found.");
            fs.writeFileSync('audit_output.json', JSON.stringify({ message: "No logs" }));
        }

    } catch (e) {
        console.error("Error:", e);
        fs.writeFileSync('audit_output.json', JSON.stringify({ error: e.message }));
    } finally {
        await prisma.$disconnect();
    }
}

main();
