
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = "leo@getspotfunnel.com";
    console.log(`Checking connection for: ${email}`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        console.error("User not found!");
        return;
    }
    console.log(`User ID: ${user.id}`);

    const connection = await prisma.calendarConnection.findUnique({ where: { userId: user.id } });
    if (!connection) {
        console.error("FAIL: No CalendarConnection found for this user.");
    } else {
        console.log("PASS: CalendarConnection exists.");
        console.log("Access Token Length:", connection.accessToken?.length);
        console.log("Refresh Token Present:", !!connection.refreshToken);

        // Also check if tokens are valid/expired? (Hard to check without api call, but presence is step 1)
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
