const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function check() {
    try {
        console.log("Checking Recent SMS failures in AuditLog...");
        const failures = await prisma.auditLog.findMany({
            where: { eventType: { in: ["SMS_API_FAILURE", "SMS_CRITICAL_FAILURE"] } },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        if (failures.length > 0) {
            console.log(`Found ${failures.length} recent failures.`);
            failures.forEach((f, i) => {
                const payload = JSON.parse(f.payload);
                console.log(`\n--- Failure ${i + 1} (${f.createdAt}) ---`);
                console.log(`Error: ${payload.error}`);
                if (i === 0) {
                    fs.writeFileSync('debug_recurrence_failure.json', JSON.stringify(payload, null, 2));
                    console.log("Full Payload for latest failure written to debug_recurrence_failure.json");
                }
            });
        } else {
            console.log("No recent SMS failures found in AuditLog.");
        }

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
