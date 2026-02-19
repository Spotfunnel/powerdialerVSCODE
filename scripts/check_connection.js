
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Checking Calendar Connection for Yarra Solar Meeting Owner ---");

    // Find the meeting again to get the userId
    const lead = await prisma.lead.findFirst({
        where: {
            companyName: { contains: "Yarra", mode: "insensitive" }
        },
        include: { meetings: true }
    });

    if (!lead || lead.meetings.length === 0) {
        console.log("Lead/Meeting not found (unexpected).");
        return;
    }

    const meeting = lead.meetings[0];
    console.log(`Meeting Title: ${meeting.title}`);
    console.log(`Meeting User ID: ${meeting.userId}`);

    // Find the connection
    const connection = await prisma.calendarConnection.findUnique({
        where: { userId: meeting.userId },
        include: { user: true }
    });

    if (!connection) {
        console.log("No Calendar Connection found for this user!");
    } else {
        console.log(`Connected User Name: ${connection.user.name}`);
        console.log(`Connected User Email (System): ${connection.user.email}`);
        console.log(`Calendar Provider: ${connection.provider}`);
        console.log(`Token Expiry: ${connection.expiry}`);

        // Sometimes valid email is hidden in access token, but we assume system email matches or we blindly trust it went to 'primary' of this connection.
        // We can't see the exact calendar email easily without decoding token or making API call, but usually it matches the authenticated user if done via NextAuth.
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
