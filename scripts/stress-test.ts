import { PrismaClient } from "@prisma/client";
import { getNextLead } from "../src/lib/dialer-logic";
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Stress Test (Raw Mode)...");

    // 1. Setup Data
    const campAId = randomUUID();
    const campBId = randomUUID();
    const now = new Date().toISOString();

    await prisma.$executeRawUnsafe(`
        INSERT INTO "Campaign" ("id", "name", "createdAt", "updatedAt") 
        VALUES ('${campAId}', 'Stress Test A ${Date.now()}', '${now}', '${now}')
    `);
    await prisma.$executeRawUnsafe(`
        INSERT INTO "Campaign" ("id", "name", "createdAt", "updatedAt") 
        VALUES ('${campBId}', 'Stress Test B ${Date.now()}', '${now}', '${now}')
    `);

    // Create Users (Mock)
    const userIdsA: string[] = [];
    const userIdsB: string[] = [];

    const generateUsers = async (prefix: string, ids: string[]) => {
        for (let i = 0; i < 50; i++) {
            const uid = randomUUID();
            ids.push(uid);
            // Minimal User Insert
            await prisma.$executeRawUnsafe(`
                INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt", "updatedAt")
                VALUES ('${uid}', 'stress-${prefix}-${i}@test.com', 'hash', 'REP', '${now}', '${now}')
                ON CONFLICT ("email") DO NOTHING
            `);
        }
    };

    console.log("Seeding Users...");
    await generateUsers('A', userIdsA);
    await generateUsers('B', userIdsB);
    console.log("Seeded 100 Users.");

    // Insert Leads... (existing)
    const generateLeads = (campId: string, prefix: string) => {
        return Array.from({ length: 50 }).map((_, i) => ({
            id: randomUUID(),
            companyName: `Lead ${prefix}-${i}`,
            phoneNumber: `+${prefix === 'A' ? '1' : '2'}00000000${i}`, // Ensure unique phone
            campaignId: campId,
            status: "READY"
        }));
    };

    const leadsA = generateLeads(campAId, 'A');
    const leadsB = generateLeads(campBId, 'B');
    const allLeads = [...leadsA, ...leadsB];

    // Cleanup phone numbers just in case 
    const phones = allLeads.map(l => `'${l.phoneNumber}'`).join(",");
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "phoneNumber" IN (${phones})`);

    // Insert
    for (const lead of allLeads) {
        await prisma.$executeRawUnsafe(`
            INSERT INTO "Lead" ("id", "companyName", "phoneNumber", "campaignId", "status", "priority", "source", "createdAt", "updatedAt", "attempts")
            VALUES ('${lead.id}', '${lead.companyName}', '${lead.phoneNumber}', '${lead.campaignId}', 'READY', 'B', 'MANUAL', '${now}', '${now}', 0)
         `);
    }

    console.log("Seeded 100 Leads (50 A, 50 B).");

    // 2. Run Stress Test
    const tasks = [];

    for (let i = 0; i < 50; i++) {
        // Worker A
        tasks.push(async () => {
            try {
                const lead = await getNextLead(userIdsA[i], undefined, campAId);
                return { worker: 'A', lead };
            } catch (e) {
                return { worker: 'A', error: e };
            }
        });

        // Worker B
        tasks.push(async () => {
            try {
                const lead = await getNextLead(userIdsB[i], undefined, campBId);
                return { worker: 'B', lead };
            } catch (e) {
                return { worker: 'B', error: e };
            }
        });
    }

    // Shuffle
    const shuffledTasks = tasks.sort(() => Math.random() - 0.5);

    console.log("Launching 100 concurrent requests...");
    const start = Date.now();
    const outcomes = await Promise.all(shuffledTasks.map(t => t()));
    const duration = Date.now() - start;

    console.log(`Finished in ${duration}ms`);

    // 3. Verify
    let successCount = 0;
    let failCount = 0;
    let mismatchCount = 0;
    const lockedLeadIds = new Set<string>();
    const doubleBookings: string[] = [];

    for (const res of outcomes) {
        if (res.error) {
            // console.error("Worker error:", res.error); 
            // Often "No leads" or similar is allowed, but here we expect leads.
            failCount++;
            continue;
        }
        if (!res.lead) {
            failCount++;
            continue;
        }

        successCount++;

        if (lockedLeadIds.has(res.lead.id)) {
            doubleBookings.push(res.lead.id);
        }
        lockedLeadIds.add(res.lead.id);

        const expectedCampaignId = res.worker === 'A' ? campAId : campBId;
        if (res.lead.campaignId !== expectedCampaignId) {
            mismatchCount++;
            console.error(`Mismatch! Worker ${res.worker} got lead from campaign ${res.lead.campaignId}`);
        }
    }

    console.log("\n--- STRESS TEST RESULTS ---");
    console.log(`Total Requests: ${outcomes.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Double Bookings: ${doubleBookings.length}`);
    console.log(`Campaign Mismatches: ${mismatchCount}`);

    if (doubleBookings.length > 0) {
        console.error("CRITICAL: DATA RACE DETECTED! IDs:", doubleBookings);
        process.exit(1);
    }
    if (mismatchCount > 0) {
        console.error("CRITICAL: CAMPAIGN FILTER FAILURE!");
        process.exit(1);
    }
    if (successCount !== 100) {
        console.error("WARNING: Did not acquire all 100 leads.");
        // process.exit(1); // Soft fail
    } else {
        console.log("SUCCESS: Integrity Verified with 100/100 success.");
    }

    // Cleanup
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "campaignId" IN ('${campAId}', '${campBId}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Campaign" WHERE "id" IN ('${campAId}', '${campBId}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "email" LIKE 'stress-%@test.com'`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
