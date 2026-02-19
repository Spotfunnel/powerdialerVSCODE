
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Reactivating All Numbers (JS) ---");

    try {
        // Update all to remove cooldown
        const result = await prisma.numberPool.updateMany({
            where: {},
            data: {
                cooldownUntil: null,
                isActive: true
            }
        });

        console.log(`Reactivated ${result.count} numbers.`);

        // Verify status
        const numbers = await prisma.numberPool.findMany({
            orderBy: { phoneNumber: 'asc' },
            include: { ownerUser: { select: { name: true } } }
        });

        console.log("\nCurrent Pool Status:");
        for (const n of numbers) {
            console.log(` - ${n.phoneNumber} | Owner: ${n.ownerUser?.name || 'Unassigned'} | Status: ${n.isActive ? 'Active' : 'Inactive'} | Cooldown: ${n.cooldownUntil || 'None'}`);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
