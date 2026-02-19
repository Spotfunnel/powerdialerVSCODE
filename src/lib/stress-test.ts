import { prisma } from "./prisma";
import { getNextLead, releaseLead } from "./dialer-logic";

/**
 * STRESS TEST: LEAD LOCKING CONCURRENCY
 * Simulates multiple reps trying to pull leads simultaneously.
 */
async function testConcurrency() {
    console.log("🚀 Starting Lead Locking Stress Test...");
    const repIds = ["rep_1", "rep_2", "rep_3", "rep_4", "rep_5"];

    const results = await Promise.all(
        repIds.map(id => getNextLead(id))
    );

    const lockedLeads = results.filter((l): l is NonNullable<typeof l> => l !== null);
    const uniqueIds = new Set(lockedLeads.map(l => l.id));

    console.log(`- Total Requests: ${repIds.length}`);
    console.log(`- Leads Locked: ${lockedLeads.length}`);
    console.log(`- Unique Leads: ${uniqueIds.size}`);

    if (lockedLeads.length !== uniqueIds.size) {
        console.error("❌ FAIL: Duplicate leads locked by different reps!");
    } else {
        console.log("✅ PASS: Atomic lead locking verified.");
    }

    // Cleanup
    for (const lead of lockedLeads) {
        await releaseLead(lead!.id);
    }
}

/**
 * STRESS TEST: HUBSPOT SYNC RETRIES -> REMOVED
 */

async function runTests() {
    try {
        await testConcurrency();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

// Only run if called directly
if (require.main === module) {
    runTests();
}
