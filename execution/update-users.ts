import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function updateUsers() {
    console.log("--- Updating System Users ---");

    const password = "Walkergewert0!";
    const passwordHash = await bcrypt.hash(password, 10);

    const usersToUpdate = [
        {
            email: "spotfunnel@outlook.com",
            name: "Kye",
            passwordHash: passwordHash,
            role: "ADMIN"
        },
        {
            email: "leo@getspotfunnel.com",
            name: "Leo",
            passwordHash: passwordHash,
            role: "ADMIN"
        }
    ];

    for (const data of usersToUpdate) {
        const user = await prisma.user.upsert({
            where: { email: data.email },
            update: {
                name: data.name,
                passwordHash: data.passwordHash,
                role: data.role
            },
            create: {
                email: data.email,
                name: data.name,
                passwordHash: data.passwordHash,
                role: data.role
            }
        });
        console.log(`Upserted user: ${user.email} (${user.name})`);
    }

    console.log("--- User Update Complete ---");
}

updateUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
