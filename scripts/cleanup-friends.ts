
import { prisma } from "../src/lib/prisma";

async function cleanupFriends() {
    console.log("Starting cleanup of 'Friend' first names...");
    const result = await prisma.lead.updateMany({
        where: { firstName: "Friend" },
        data: { firstName: null }
    });
    console.log(`Cleaned up ${result.count} records.`);
}

cleanupFriends();
