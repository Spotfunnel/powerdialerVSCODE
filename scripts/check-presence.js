const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- User Status ---");
    const users = await prisma.user.findMany({
        select: { email: true, lastSeenAt: true, name: true }
    });
    users.forEach(u => {
        console.log(`${u.name} (${u.email}): Last Seen ${u.lastSeenAt ? u.lastSeenAt.toISOString() : 'Never'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
