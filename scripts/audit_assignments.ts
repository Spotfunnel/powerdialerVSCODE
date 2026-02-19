
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNumberPool() {
    console.log('--- NumberPool Audit ---');
    try {
        const numbers = await prisma.numberPool.findMany({
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        if (numbers.length === 0) {
            console.log('No numbers found in NumberPool.');
        } else {
            numbers.forEach(num => {
                console.log(`Number: ${num.phoneNumber}`);
                console.log(`  Owner: ${num.owner ? `${num.owner.name} (${num.owner.email})` : 'UNASSIGNED'}`);
                console.log(`  Active: ${num.isActive}`);
                console.log('-------------------------');
            });
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                repPhoneNumber: true
            }
        });
        console.log('\n--- User Meta Audit ---');
        users.forEach(user => {
            console.log(`User: ${user.name} (${user.email})`);
            console.log(`  Rep Phone: ${user.repPhoneNumber || 'NONE'}`);
        });

    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkNumberPool();
