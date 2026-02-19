
import { prisma } from '../src/lib/prisma';

async function main() {
    const emailQuery = 'leo'; // Broad search to find correct user
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: emailQuery, mode: 'insensitive' } },
                { email: { contains: emailQuery, mode: 'insensitive' } }
            ]
        }
    });

    console.log('Found users:', users.map(u => `${u.name} (${u.email}) - ${u.id}`));

    const leo = users.find(u => u.name?.toLowerCase().includes('leo') || u.email.toLowerCase().includes('leo'));

    if (!leo) {
        console.error('User "Leo" not found!');
        process.exit(1);
    }

    console.log(`Resetting stats for: ${leo.name} (${leo.id})`);

    // 1. Delete all existing calls for Leo
    const deleted = await prisma.call.deleteMany({
        where: { userId: leo.id }
    });
    console.log(`Deleted ${deleted.count} existing calls.`);

    // 2. Create Lead if needed (for foreign key)
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
    // Note: 'SOLD' might not be a valid outcome in strict enums if they exist, but the API uses string text.
    // API checks for `outcome: 'BOOKED'` and `outcome: 'SOLD'`.

    await prisma.call.create({
        data: {
            userId: leo.id,
            leadId: lead.id,
            direction: 'OUTBOUND',
            fromNumber: '+61400000000',
            toNumber: '+61411111111',
            status: 'completed',
            outcome: 'BOOKED',
            duration: 120,
            notes: 'Test Booking'
        }
    });
    console.log('Created BOOKED call.');

    await prisma.call.create({
        data: {
            userId: leo.id,
            leadId: lead.id,
            direction: 'OUTBOUND',
            fromNumber: '+61400000000',
            toNumber: '+61422222222',
            status: 'completed',
            outcome: 'SOLD',
            duration: 300,
            notes: 'Test Sale'
        }
    });
    console.log('Created SOLD call.');

    console.log('Done.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
