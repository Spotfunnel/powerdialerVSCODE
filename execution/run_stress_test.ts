
import { prisma } from "../src/lib/prisma";
import { getNextLead, releaseLead } from "../src/lib/dialer-logic";
import { LeadStatus } from "../src/lib/types";

async function testConcurrency() {
    console.log("🚀 Starting Lead Locking Stress Test (High Concurrency)...");

    // Simulate 20 concurrent requests (Leo and Kye mashing the button)
    const reps = Array.from({ length: 20 }, (_, i) => `rep_${i}`);

    console.log(`[SETUP] Ensuring mock users exist...`);
    for (const repId of reps) {
        await prisma.user.upsert({
            where: { email: `${repId}@test.com` }, // Using email as unique key for upsert
            update: {},
            create: {
                id: repId, // Force the ID to match our test ID
                email: `${repId}@test.com`,
                passwordHash: "mock_hash",
                name: `Test Rep ${repId}`
            }
        });
    }

    console.log(`[SETUP] Ensuring enough READY leads exist...`);
    // Reset some leads to ensure we have enough to test
    await prisma.lead.updateMany({
        where: { notes: { contains: "STRESS_TEST" } },
        data: { status: "READY", lockedAt: null, lockedById: null }
    });

    // Create temp leads if needed
    const existingCount = await prisma.lead.count({ where: { status: "READY" } });
    if (existingCount < 20) {
        console.log(`[SETUP] Creating ${20 - existingCount} temporary testing leads...`);
        for (let i = 0; i < (20 - existingCount); i++) {
            await prisma.lead.create({
                data: {
                    phoneNumber: `+199999999${i.toString().padStart(2, '0')}`,
                    companyName: `Test Corp ${i}`,
                    notes: "STRESS_TEST",
                    status: "READY"
                }
            });
        }
    }

    console.log(`[TEST] Launching ${reps.length} simultaneous 'getNextLead' requests...`);
    const start = Date.now();
    const results = await Promise.all(
        reps.map(id => getNextLead(id))
    );
    const duration = Date.now() - start;

    const lockedLeads = results.filter((l): l is NonNullable<typeof l> => l !== null);
    const uniqueIds = new Set(lockedLeads.map(l => l.id));
    const duplicates = lockedLeads.length - uniqueIds.size;

    console.log(`\n📊 RESULTS:`);
    console.log(`- Time Taken: ${duration}ms`);
    console.log(`- Total Requests: ${reps.length}`);
    console.log(`- Leads Locked: ${lockedLeads.length}`);
    console.log(`- Unique Leads: ${uniqueIds.size}`);
    console.log(`- Collisions Handled: ${reps.length - lockedLeads.length} (Reps who got 'null' or retried)`);
    console.log(`- DUPLICATE LOCKS: ${duplicates}`);

    if (duplicates > 0) {
        console.error("❌ CRTICAL FAIL: The database allowed duplicate locks!");
        process.exit(1);
    } else if (lockedLeads.length === 0) {
        console.error("❌ FAIL: No leads were locked (maybe query error?)");
        process.exit(1);
    } else {
        console.log("✅ PASS: Atomic Locking Guard is 100% Effective.");
    }

    // Cleanup
    console.log(`[CLEANUP] Releasing leads...`);
    for (const lead of lockedLeads) {
        await releaseLead(lead!.id);
    }
}

testConcurrency()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
