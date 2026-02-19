const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Checking Database State ---");

    // 1. Check Users
    const users = await prisma.user.findMany({
        where: {
            OR: [{ email: 'leo@getspotfunnel.com' }, { email: { contains: 'spotfunnel' } }]
        },
        select: { id: true, email: true, name: true }
    });
    console.log("\nUsers Found:", users);

    // 2. Check Numbers
    const numbers = await prisma.numberPool.findMany({
        include: { owner: { select: { email: true } } },
        orderBy: { phoneNumber: 'asc' }
    });

    console.log(`\nTotal Numbers in Pool: ${numbers.length}`);
    if (numbers.length === 0) {
        console.log("CRITICAL: NumberPool is empty!");
    } else {
        console.table(numbers.map(n => ({
            Phone: n.phoneNumber,
            Owner: n.owner?.email || 'UNASSIGNED',
            Active: n.isActive
        })));
    }

    // 3. Compare with expected
    const leo = users.find(u => u.email === 'leo@getspotfunnel.com');
    if (leo) {
        const leoCount = numbers.filter(n => n.ownerUserId === leo.id).length;
        console.log(`\nVerified Assignments for Leo: ${leoCount} (Expected 4)`);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
