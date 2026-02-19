const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Get ANY lead
        const lead = await prisma.lead.findFirst();

        if (!lead) {
            console.error("No leads in DB!");
            return;
        }

        console.log("Found Lead:", lead.id);
        console.log("Lead Phone:", lead.phoneNumber);

        // 2. Simulate the Logic
        // const lead = await prisma.lead.findUnique({ where: { id: leadId } });

        console.log("Simulating findUnique...");
        const lookup = await prisma.lead.findUnique({ where: { id: lead.id } });

        if (lookup) {
            console.log("Lookup Success!");
            console.log("Resolved Number:", lookup.phoneNumber);
        } else {
            console.error("Lookup FAILED (Returned null)");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
