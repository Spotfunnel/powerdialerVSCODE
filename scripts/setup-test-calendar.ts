
import { prisma } from "../src/lib/prisma";

async function main() {
    const email = "stress-test-user@example.com";

    // 1. Get the Test Bot
    const bot = await prisma.user.findUnique({ where: { email } });
    if (!bot) {
        console.error("Bot not found. Run set-test-password.ts first.");
        return;
    }

    // 2. Find a Donor User (Real user with connection)
    // Try to find someone with a CalendarConnection
    const donorConnection = await prisma.calendarConnection.findFirst({
        where: { refreshToken: { not: null } }
    });

    if (!donorConnection) {
        console.error("No donor connection found! Cannot mock Google Calendar.");
        // Fallback: If no dedicated connection, maybe check Account table if NextAuth stores it there?
        // But schema shows CalendarConnection model.
        return;
    }

    console.log(`Found donor connection from User ID: ${donorConnection.userId}`);

    // 3. Clone Connection to Bot
    await prisma.calendarConnection.upsert({
        where: { userId: bot.id },
        update: {
            provider: donorConnection.provider,
            accessToken: donorConnection.accessToken,
            refreshToken: donorConnection.refreshToken,
            expiry: donorConnection.expiry
        },
        create: {
            userId: bot.id,
            provider: donorConnection.provider,
            accessToken: donorConnection.accessToken,
            refreshToken: donorConnection.refreshToken,
            expiry: donorConnection.expiry
        }
    });

    console.log(`✅ Cloned Calendar Connection to Bot (${bot.id}). Ready for E2E Test.`);
}

main();
