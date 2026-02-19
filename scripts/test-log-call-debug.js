const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Get user
        const user = await prisma.user.findFirst();
        if (!user) { console.log("No user"); return; }

        console.log(`Writing test call for user: ${user.email} (${user.id})`);

        // 2. Find a lead to attach to (or create dummy)
        let lead = await prisma.lead.findFirst();
        if (!lead) {
            console.log("No leads found, skipping log.");
            return;
        }

        // 3. Create Log
        const result = await prisma.leadActivity.create({
            data: {
                leadId: lead.id,
                userId: user.id,
                type: 'CALL',
                notes: 'DEBUG SCRIPT LOG',
                createdAt: new Date()
            }
        });

        console.log("Logged call successfully:", result.id);

    } catch (e) {
        console.error("Failed to write log:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
