
import { prisma } from "../src/lib/prisma";

async function checkContact() {
    const phone = process.argv[2];
    if (!phone) {
        console.log("Please provide phone number");
        return;
    }

    const lead = await prisma.lead.findFirst({
        where: { phoneNumber: { contains: phone } }
    });

    console.log("Found Lead:", lead);
}

checkContact();
