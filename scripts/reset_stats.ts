
import { prisma } from '../src/lib/prisma';

async function main() {
    const usersToReset = ['leo', 'kye'];

    for (const query of usersToReset) {
        console.log(`\nProcessing user query: "${query}"`);

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } }
                ]
            }
        });

        const user = users.find(u => u.name?.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));

        if (!user) {
            console.error(`User "${query}" not found! Skipping.`);
            continue;
        }

        console.log(`Found User: ${user.name} (${user.email}) - ID: ${user.id}`);
        console.log(`Resetting stats...`);

        // 1. Delete all existing calls for User
        const deleted = await prisma.call.deleteMany({
            where: { userId: user.id }
        });
        console.log(`Deleted ${deleted.count} existing calls.`);

        // 2. Ensure a Lead exists
        let lead = await prisma.lead.findFirst();
        if (!lead) {
            lead = await prisma.lead.create({
                data: {
                    companyName: "Test Company",
                    phoneNumber: "+61400000000",
                    firstName: "Test",
                    lastName: "Lead"
                }
            });
        }

        // 3. Create 2 Calls: 1 Booked, 1 Sold
        await prisma.call.create({
            data: {
                userId: user.id,
                leadId: lead.id,
                direction: 'OUTBOUND',
                fromNumber: '+61400000000',
                toNumber: '+61411111111',
                status: 'completed',
                outcome: 'BOOKED',
                duration: 120,
                createdAt: new Date(), // Ensure it counts for today/this week if filtered
                updatedAt: new Date()
            }
        });
        console.log('Created BOOKED call.');

        await prisma.call.create({
            data: {
                userId: user.id,
                leadId: lead.id,
                direction: 'OUTBOUND',
                fromNumber: '+61400000000',
                toNumber: '+61422222222',
                status: 'completed',
                outcome: 'SOLD',
                duration: 300,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });
        console.log('Created SOLD call.');
    }

    console.log('\nDone.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
