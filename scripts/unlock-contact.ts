import { prisma } from "../src/lib/prisma";

async function unlockLead() {
    const phone = process.argv[2];
    if (!phone) return console.log("No phone provided");

    await prisma.lead.update({
        where: { phoneNumber: phone },
        data: { status: 'READY', lockedById: null, lockedAt: null }
    });
    console.log("Unlocked lead:", phone);
}

unlockLead();
