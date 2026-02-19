
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'leo@getspotfunnel.com';
    console.log(`--- Checking User: ${email} ---`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: { calendarConnection: true }
    });

    if (!user) {
        console.log(`User ${email} NOT FOUND.`);
        return;
    }

    console.log(`User ID: ${user.id}`);
    console.log(`Name: ${user.name}`);

    if (user.calendarConnection) {
        console.log("Calendar Connection: EXISTS");
        console.log(`  Provider: ${user.calendarConnection.provider}`);
        console.log(`  Expiry: ${user.calendarConnection.expiry}`);
        console.log(`  Has Access Token: ${!!user.calendarConnection.accessToken}`);
        console.log(`  Has Refresh Token: ${!!user.calendarConnection.refreshToken}`);
    } else {
        console.log("Calendar Connection: MISSING");
    }

    // Now check the Yarra meeting creator again
    const leads = await prisma.lead.findMany({
        where: { companyName: { contains: "Yarra", mode: "insensitive" } },
        include: { meetings: true }
    });

    if (leads.length > 0 && leads[0].meetings.length > 0) {
        const meeting = leads[0].meetings[0];
        console.log(`\nYarra Meeting Creator ID: ${meeting.userId}`);
        if (meeting.userId === user.id) {
            console.log("MATCH: Meeting was created by this user.");
        } else {
            console.log("MISMATCH: Meeting was created by a DIFFERENT user.");
            // Find that user
            const creator = await prisma.user.findUnique({ where: { id: meeting.userId } });
            console.log(`Creator was: ${creator ? creator.email : 'Unknown ID'}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
