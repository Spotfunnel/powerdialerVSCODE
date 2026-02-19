
import { prisma } from "../src/lib/prisma";

async function main() {
    const phones = ["0499999999", "0499 999 999", "+61499999999", "+61 499 999 999", "61499999999"];

    // Use deleteMany
    const deleted = await prisma.lead.deleteMany({
        where: {
            OR: [
                { phoneNumber: { in: phones } },
                { phoneNumber: { contains: "499999999" } }
            ]
        }
    });

    console.log("Deleted count:", deleted.count);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
