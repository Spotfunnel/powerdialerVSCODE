const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log("--- CALLS TODAY ---");
    const calls = await prisma.call.findMany({
        where: { createdAt: { gte: today } },
        orderBy: { createdAt: 'desc' },
        include: { lead: true }
    });
    console.log(`Found ${calls.length} calls today.`);
    calls.forEach(c => {
        console.log(`[${c.createdAt.toISOString()}] Direction: ${c.direction}, From: ${c.fromNumber}, Status: ${c.status}`);
    });

    console.log("\n--- RECENT CALLS (LONG TERM) ---");
    const recent = await prisma.call.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    recent.forEach(c => {
        console.log(`[${c.createdAt.toISOString()}] Direction: ${c.direction}, From: ${c.fromNumber}, Status: ${c.status}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
