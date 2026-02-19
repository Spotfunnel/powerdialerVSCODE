const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const output = {};

    try {
        const pools = await prisma.numberPool.findMany({
            include: { owner: true }
        });

        output.count = pools.length;
        output.numbers = pools.map(p => ({
            id: p.id,
            phone: p.phoneNumber,
            owner: p.owner?.email || 'Unassigned',
            region: p.regionTag
        }));

        fs.writeFileSync('pool_check.json', JSON.stringify(output, null, 2));

    } catch (e) {
        console.error("Error:", e);
        fs.writeFileSync('pool_check.json', JSON.stringify({ error: e.message }));
    } finally {
        await prisma.$disconnect();
    }
}

main();
