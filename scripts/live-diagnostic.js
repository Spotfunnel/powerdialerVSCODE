
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- LIVE DIAGNOSTIC: ANALYZING RECENT FAILURES ---");
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                createdAt: { gte: tenMinutesAgo },
                eventType: { in: ['SMS_API_FAILURE', 'SMS_CRITICAL_FAILURE', 'SMS_API_HIT', 'SMS_SEND_ATTEMPT'] }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Found ${logs.length} relevant logs in the last 10 minutes.`);

        logs.forEach(l => {
            console.log(`\n[${l.createdAt.toISOString()}] EVENT: ${l.eventType}`);
            try {
                const payload = JSON.parse(l.payload);
                if (payload.error) console.log("ERROR MESSAGE:", payload.error);
                if (payload.cleanFrom) console.log("RESOLVED FROM:", payload.cleanFrom);
                if (payload.fromNumber) console.log("RAW FROM ENV:", payload.fromNumber);
                if (payload.stack) {
                    console.log("STACK TRACE (First 3 lines):");
                    console.log(payload.stack.split('\n').slice(0, 3).join('\n'));
                }
                // Print small snippets of other data
                const keys = Object.keys(payload).filter(k => !['error', 'stack', 'payload'].includes(k));
                if (keys.length > 0) {
                    const smallPayload = {};
                    keys.forEach(k => smallPayload[k] = payload[k]);
                    console.log("DATA:", JSON.stringify(smallPayload));
                }
            } catch (e) {
                console.log("RAW PAYLOAD:", l.payload);
            }
            console.log("---");
        });

    } catch (e) {
        console.error("DIAGNOSTIC FAILED:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
