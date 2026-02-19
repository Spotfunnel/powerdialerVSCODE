
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Assigning Numbers ---");

    // 1. Get Users
    const leo = await prisma.user.findFirst({ where: { name: { contains: 'Leo', mode: 'insensitive' } } });
    const kye = await prisma.user.findFirst({ where: { name: { contains: 'Kye', mode: 'insensitive' } } });

    if (!leo || !kye) {
        console.error("Could not find Leo or Kye users.");
        return;
    }
    console.log(`Found Leo: ${leo.id}`);
    console.log(`Found Kye: ${kye.id}`);

    // 2. Get All Pool Numbers
    const numbers = await prisma.numberPool.findMany({
        orderBy: { phoneNumber: 'asc' }
    });

    console.log(`Total Numbers in Pool: ${numbers.length}`);

    if (numbers.length === 0) {
        console.log("No numbers to assign.");
        return;
    }

    // 3. Distribute
    // We want to give half to Leo, half to Kye.
    const half = Math.ceil(numbers.length / 2);
    const leoNumbers = numbers.slice(0, half);
    const kyeNumbers = numbers.slice(half);

    console.log(`Assigning ${leoNumbers.length} numbers to Leo...`);
    for (const n of leoNumbers) {
        await prisma.numberPool.update({
            where: { id: n.id },
            data: { ownerUserId: leo.id }
        });
        console.log(` - ${n.phoneNumber} -> Leo`);
    }

    console.log(`Assigning ${kyeNumbers.length} numbers to Kye...`);
    for (const n of kyeNumbers) {
        await prisma.numberPool.update({
            where: { id: n.id },
            data: { ownerUserId: kye.id }
        });
        console.log(` - ${n.phoneNumber} -> Kye`);
    }

    console.log("Assignment Complete.");
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
