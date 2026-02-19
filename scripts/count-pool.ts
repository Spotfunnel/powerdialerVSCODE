
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- Pool Stats ---");

    const total = await prisma.numberPool.count();
    const active = await prisma.numberPool.count({ where: { isActive: true } });
    const available = await prisma.numberPool.count({
        where: {
            isActive: true,
            OR: [
                { cooldownUntil: null },
                { cooldownUntil: { lte: new Date() } }
            ]
        }
    });

    console.log(`Total: ${total}`);
    console.log(`Active: ${active}`);
    console.log(`Available (Ready/No Cooldown): ${available}`);

    const cooldowns = await prisma.numberPool.findMany({
        where: { cooldownUntil: { gt: new Date() } }
    });

    console.log(`\nNumbers on Cooldown (${cooldowns.length}):`);
    cooldowns.forEach(n => console.log(`  - ${n.phoneNumber} until ${n.cooldownUntil}`));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
