
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
    const email = "stress-test-user@example.com";
    const password = "testpassword123";

    const hash = await bcrypt.hash(password, 10);

    // Upsert user
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hash,
            name: "Stress Test Bot",
            role: "SPECIALIST"
        },
        create: {
            email,
            passwordHash: hash,
            name: "Stress Test Bot",
            role: "SPECIALIST",
            repPhoneNumber: "+61400000000"
        }
    });

    console.log(`Updated user ${email} with password: ${password}`);
    console.log(`User ID: ${user.id}`);
}

main();
