
import { prisma } from "../src/lib/prisma";

async function main() {
    const lead = await prisma.lead.upsert({
        where: { phoneNumber: "0499999999" },
        update: {},
        create: {
            firstName: "Final",
            lastName: "Verify",
            email: "final@test.com",
            phoneNumber: "0499999999",
            companyName: "Stress Test Corp",
            status: "READY",
        },
    });

    console.log("Seeded Lead:", lead);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
