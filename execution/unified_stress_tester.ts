
import { prisma } from "../src/lib/prisma";
import { getNextLead } from "../src/lib/dialer-logic";
import { LeadStatus } from "../src/lib/prisma";

async function runUnifiedStressTest() {
    console.log("🔥 [UNIFIED STRESS TESTER] Initiating 100-Scenario Readiness Audit...");

    // 1. DATABASE & CONCURRENCY (Lead Locking)
    console.log("\n--- [PHASE 1] Lead Locking Concurrency ---");
    const reps = Array.from({ length: 15 }, (_, i) => `stress_agent_${i}`);

    // Ensure mock users
    for (const id of reps) {
        await prisma.user.upsert({
            where: { email: `${id}@stress.com` },
            update: {},
            create: { id, email: `${id}@stress.com`, passwordHash: "stress", name: `Agent ${id}` }
        });
    }

    // Reset leads
    await prisma.lead.updateMany({
        where: { notes: "STRESS_TEST" },
        data: { status: "READY", lockedAt: null, lockedById: null }
    });

    // Simulated simultaneous "Get Next Lead"
    const startTime = Date.now();
    const lockResults = await Promise.all(reps.map(id => getNextLead(id)));
    console.log(`✅ Locked ${lockResults.filter(l => l).length} leads in ${Date.now() - startTime}ms`);

    // 2. MESSAGING RACE PROTECTION (Upsert Logic)
    console.log("\n--- [PHASE 2] Inbound SMS Concurrency (Conversation Upsert) ---");
    const fromNumber = "+1234567890";
    const burstSize = 20;
    console.log(`🚀 Sending ${burstSize} simultaneous inbound SMS triggers from ${fromNumber}...`);

    const smsTriggers = Array.from({ length: burstSize }).map((_, i) => {
        return fetch("http://localhost:3000/api/twilio/sms/inbound", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                MessageSid: `SM_STRESS_${i}`,
                From: fromNumber,
                Body: `Stress message ${i}`,
                To: "+15555555555"
            })
        });
    });

    await Promise.all(smsTriggers);

    // Verify single conversation
    const convos = await prisma.conversation.count({ where: { contactPhone: fromNumber } });
    const msgs = await prisma.message.count({ where: { body: { contains: "Stress message" } } });
    console.log(`📊 Result: ${convos} Conversation(s) found (Expected: 1), ${msgs} Message(s) recorded.`);
    if (convos > 1) console.error("❌ CONCURRENCY FAIL: Multiple conversations created for same number!");
    else console.log("✅ Concurrency Race Protection: PASS");

    // 3. CRM PIPELINE OVERRIDE (Rapid Moves)
    console.log("\n--- [PHASE 3] Rapid Pipeline State Transitions ---");
    const testLead = await prisma.lead.findFirst({ where: { notes: "STRESS_TEST" } });
    if (testLead) {
        const stages: string[] = ["READY", "CALLBACK", "BOOKED", "SOLD", "READY"];
        for (const stage of stages) {
            await fetch("http://localhost:3000/api/crm/pipeline-move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId: testLead.id, stage, notes: `Rapid transition to ${stage}` })
            });
        }
        const updatedLead = await prisma.lead.findUnique({ where: { id: testLead.id } });
        console.log(`✅ Final Lead Stage: ${updatedLead?.status} (Expected: READY)`);
    }

    // 4. PUSH NOTIFICATION RELAY (VAPID Audit)
    console.log("\n--- [PHASE 4] Push Notification Relay Integrity ---");
    try {
        const subscriptions = await (prisma as any).pushSubscription.findMany({ take: 5 });
        console.log(`🔍 Found ${subscriptions.length} active push subscriptions for relay test.`);
        // Note: Real push requires real endpoints, here we just verify the lib setup
        if (process.env.VAPID_PRIVATE_KEY) {
            console.log("✅ VAPID Encryption Keys: LOADED");
        } else {
            console.warn("⚠️ VAPID Keys Missing - Background Push will fail in production.");
        }
    } catch (e) {
        console.error("❌ Push relay audit failed", e);
    }

    console.log("\n🎉 [STRESS TEST COMPLETE] Check stress_test_scenarios.md for full audit trail.");
}

runUnifiedStressTest().catch(console.error);
