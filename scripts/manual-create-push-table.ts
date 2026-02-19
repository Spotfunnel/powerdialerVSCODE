
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Creating PushSubscription table manually...");

    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "PushSubscription" (
                "id" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                "endpoint" TEXT NOT NULL,
                "p256dh" TEXT NOT NULL,
                "auth" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,
            
                CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log("Table created (or existed).");

        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
        `);
        console.log("Index created.");

        // Add FK if not exists (Postgres doesn't support IF NOT EXISTS for constraints easily, skipping if it fails is fine)
        try {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            `);
            console.log("FK Constraint added.");
        } catch (e: any) {
            console.log("FK Constraint might already exist:", e.message);
        }

    } catch (e: any) {
        console.error("Error creating table:", e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
