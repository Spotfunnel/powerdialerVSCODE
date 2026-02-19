
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Reactivating All Numbers (Loop) ---");

    try {
        const numbers = await prisma.numberPool.findMany();
        console.log(`Found ${numbers.length} numbers.`);

        for (const n of numbers) {
            await prisma.numberPool.update({
                where: { id: n.id },
                data: { cooldownUntil: null, isActive: true }
            });
            // console.log(`Reactivated ${n.phoneNumber}`);
        }
        console.log("All numbers reactivated.");

        // Verify status
        const updated = await prisma.numberPool.findMany({
            orderBy: { phoneNumber: 'asc' },
            include: { ownerUser: { select: { name: true } } }
        });

        console.log("\nCurrent Pool Status:");
        for (const n of updated) {
            console.log(` - ${n.phoneNumber} | Owner: ${n.ownerUser?.name || 'Unassigned'} | Status: ${n.isActive ? 'Active' : 'Inactive'} | Cooldown: ${n.cooldownUntil || 'None'}`);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
