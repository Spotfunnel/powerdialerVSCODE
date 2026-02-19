
import { PrismaClient } from "@prisma/client";
import { updateLeadDisposition, DispositionDeps } from "../src/lib/dialer-logic";
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// --- MOCKS ---
const mockSendSMS = async (args: any) => {
    // console.log(`[MOCK] Sending SMS to ${args.to}: ${args.body}`);
    return Promise.resolve({ sid: "mock_sid" });
};

const mockCreateGoogleMeeting = async (args: any) => {
    // console.log(`[MOCK] Creating Meeting: ${args.title} in ${args.timeZone}`);
    return Promise.resolve({
        id: `gcal_${randomUUID()}`,
        meetingUrl: "https://meet.google.com/mock-link",
        provider: "google"
    });
};

const deps: DispositionDeps = {
    sendSMS: mockSendSMS,
    createGoogleMeeting: mockCreateGoogleMeeting
};

// --- TYPES ---
interface TestScenario {
    id: number;
    description: string;
    initialState: {
        status: string;
        attempts: number;
        lockedById?: string;
    };
    action: {
        status: string;
        nextCallAt?: string;
        notes?: string;
        timezone?: string;
        includeMeetLink?: boolean;
    };
    expected: {
        status: string;
        attemptsIncrement: number;
        shouldCreateMeeting: boolean;
        shouldCreateCallback: boolean;
        shouldArchive: boolean;
    };
}

async function main() {
    console.log("Starting Comprehensive Disposition Simulation (100 Scenarios)...");
    const startTime = Date.now();

    // 1. SETUP
    const campaignId = randomUUID();
    const userId = randomUUID();
    const now = new Date().toISOString();

    console.log("Setting up environment...");
    // PRE-CLEANUP: Remove stale test data from previous failed runs
    try {
        console.log("Pre-cleanup: Deleting stale data...");
        // Delete children of Leads first
        await prisma.$executeRawUnsafe(`DELETE FROM "Meeting" WHERE "leadId" IN (SELECT id FROM "Lead" WHERE "phoneNumber" LIKE '+1555%')`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Callback" WHERE "leadId" IN (SELECT id FROM "Lead" WHERE "phoneNumber" LIKE '+1555%')`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Call" WHERE "leadId" IN (SELECT id FROM "Lead" WHERE "phoneNumber" LIKE '+1555%')`);

        // Delete Leads
        await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "phoneNumber" LIKE '+1555%'`);

        // Delete Users
        await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "email" LIKE 'sim-user-%'`);
        console.log("Pre-cleanup done.");
    } catch (e) { console.log("Pre-cleanup warning:", e); }

    await prisma.$executeRawUnsafe(`
        INSERT INTO "Campaign" ("id", "name", "createdAt", "updatedAt") 
        VALUES ('${campaignId}', 'Sim Campaign ${Date.now()}', '${now}', '${now}')
    `);

    await prisma.$executeRawUnsafe(`
        INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt", "updatedAt", "name", "repPhoneNumber")
        VALUES ('${userId}', 'sim-user-${Date.now()}@test.com', 'hash', 'REP', '${now}', '${now}', 'Sim User', '+15550009999')
    `);

    // 2. GENERATE SCENARIOS
    // We want 100 distinct scenarios with varying initial states and actions.
    const scenarios: TestScenario[] = [];
    const statuses = ['NO_ANSWER', 'NOT_INTERESTED', 'BOOKED', 'CALLBACK', 'DQ'];

    for (let i = 0; i < 100; i++) {
        // Distribute scenarios logic
        let actionStatus = statuses[i % statuses.length];

        let initialAttempts = Math.floor(Math.random() * 3); // 0, 1, 2
        let initialStatus: string = 'READY';

        // Specific logic for forcing edge cases
        if (i < 10) {
            // SCENARIO 1-10: Booking Logic across timezones
            actionStatus = 'BOOKED';
        } else if (i < 20) {
            // SCENARIO 11-20: Callback Logic
            actionStatus = 'CALLBACK';
        } else if (i < 40) {
            // SCENARIO 21-40: No Answer / Archive Logic
            actionStatus = 'NO_ANSWER';
            initialAttempts = i % 2 === 0 ? 2 : 0; // Force some to be on edge (2 attempts)
        }

        // Define Expectation
        let expectedStatus = actionStatus;
        let shouldArchive = false;
        if (actionStatus === 'NO_ANSWER' && initialAttempts >= 2) {
            expectedStatus = 'ARCHIVED';
            shouldArchive = true;
        }

        const nextCallAt = (actionStatus === 'BOOKED' || actionStatus === 'CALLBACK')
            ? new Date(Date.now() + 86400000).toISOString() // Tomorrow
            : undefined;

        scenarios.push({
            id: i,
            description: `Scenario ${i}: In: ${initialAttempts} atts -> Act: ${actionStatus}`,
            initialState: {
                status: initialStatus,
                attempts: initialAttempts,
                lockedById: userId
            },
            action: {
                status: actionStatus,
                nextCallAt,
                notes: `Simulated note ${i}`,
                timezone: i % 2 === 0 ? "11" : "10", // Alternating timezones
                includeMeetLink: i % 3 === 0
            },
            expected: {
                status: expectedStatus,
                attemptsIncrement: 1,
                shouldCreateMeeting: actionStatus === 'BOOKED',
                shouldCreateCallback: actionStatus === 'CALLBACK',
                shouldArchive
            }
        });
    }

    // 3. EXECUTE (Batched Concurrency)
    let passed = 0;
    let failed = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < scenarios.length; i += BATCH_SIZE) {
        const batch = scenarios.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i + 1}-${Math.min(i + BATCH_SIZE, scenarios.length)}...`);

        await Promise.all(batch.map(async (scenario) => {
            const leadId = randomUUID();
            const phone = `+1555${scenario.id.toString().padStart(6, '0')}`;

            try {
                // Create Lead
                await prisma.$executeRawUnsafe(`
                    INSERT INTO "Lead" ("id", "companyName", "phoneNumber", "campaignId", "status", "priority", "source", "createdAt", "updatedAt", "attempts", "lockedById", "lockedAt")
                    VALUES ('${leadId}', 'Lead ${scenario.id}', '${phone}', '${campaignId}', '${scenario.initialState.status}', 'B', 'MANUAL', '${now}', '${now}', ${scenario.initialState.attempts}, '${scenario.initialState.lockedById || null}', '${now}')
                `);

                // Execute Action
                await updateLeadDisposition(leadId, userId, scenario.action, deps);

                // Verify
                const updatedLead = await prisma.lead.findUnique({ where: { id: leadId } });
                if (!updatedLead) throw new Error("Lead vanished");

                let errors: string[] = [];

                // 1. Check Status
                if (updatedLead.status !== scenario.expected.status) {
                    errors.push(`Status Mismatch: Expected ${scenario.expected.status}, got ${updatedLead.status}`);
                }

                // 2. Check Attempts
                if (updatedLead.attempts !== scenario.initialState.attempts + scenario.expected.attemptsIncrement) {
                    errors.push(`Attempts Mismatch: Expected ${scenario.initialState.attempts + scenario.expected.attemptsIncrement}, got ${updatedLead.attempts}`);
                }

                // 3. Check Lock Released
                if (updatedLead.lockedById !== null) {
                    errors.push("Lead still locked!");
                }

                // 4. Check Side Effects
                if (scenario.expected.shouldCreateMeeting) {
                    const meeting = await prisma.meeting.findFirst({ where: { leadId } });
                    if (!meeting) errors.push("Meeting not created");
                    else if (meeting.provider !== 'google') errors.push("Meeting provider not set (Mock GCal failed?)");
                }

                if (scenario.expected.shouldCreateCallback) {
                    const cb = await prisma.callback.findFirst({ where: { leadId } });
                    if (!cb) errors.push("Callback not created");
                }

                // 5. Check Call Log
                const call = await prisma.call.findFirst({ where: { leadId } });
                if (!call) errors.push("Call log not created");
                if (call?.outcome !== scenario.action.status) errors.push("Call log outcome mismatch");


                if (errors.length > 0) {
                    console.error(`❌ FAILED Scenario ${scenario.id}: ${scenario.description}`, errors);
                    failed++;
                } else {
                    passed++;
                }
            } catch (e: any) {
                console.error(`❌ ERROR Scenario ${scenario.id}`, e);
                failed++;
            }
        }));
    }

    console.log("\n--- SIMULATION RESULTS ---");
    console.log(`Verified 100 Scenarios in ${Date.now() - startTime}ms`);
    console.log(`Passed: ${passed}/100`);
    console.log(`Failed: ${failed}/100`);

    // 4. CLEANUP
    console.log("Cleaning up...");
    await prisma.$executeRawUnsafe(`DELETE FROM "Meeting" WHERE "userId" = '${userId}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Callback" WHERE "userId" = '${userId}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Call" WHERE "userId" = '${userId}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Lead" WHERE "campaignId" = '${campaignId}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Campaign" WHERE "id" = '${campaignId}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = '${userId}'`);

    if (failed > 0) process.exit(1);
}

main().catch(console.error);
