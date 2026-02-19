
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Reactivating All Numbers V3 ---");

    try {
        const numbers = await prisma.numberPool.findMany();
        console.log(`Found ${numbers.length} numbers to check.`);

        for (const n of numbers) {
            try {
                await prisma.numberPool.update({
                    where: { id: n.id },
                    data: { cooldownUntil: null, isActive: true }
                });
                console.log(`OK: ${n.phoneNumber}`);
            } catch (updateErr) {
                console.error(`FAILED: ${n.phoneNumber}`, updateErr.message);
            }
        }
        console.log("\n--- Final Status ---");
        const updated = await prisma.numberPool.findMany({ orderBy: { phoneNumber: 'asc' } });
        for (const n of updated) {
            console.log(` - ${n.phoneNumber}: Active=${n.isActive}, Cooldown=${n.cooldownUntil}`);
        }

    } catch (e) {
        console.error("Global Error:", e);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
