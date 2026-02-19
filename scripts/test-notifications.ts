
import { PrismaClient } from "@prisma/client";
import webpush from "web-push";
import { sendPushNotification } from "../src/lib/push";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// --- MOCK WEB PUSH ---
// We overwrite the sendNotification method to simulate network requests
const ORIGINAL_SEND = webpush.sendNotification;
let MOCK_MODE = true;
let FAIL_RATE = 0.1; // 10% of subscriptions are "expired"

// @ts-ignore
webpush.sendNotification = async (subscription: any, payload: any) => {
    if (!MOCK_MODE) {
        return ORIGINAL_SEND(subscription, payload);
    }

    // Simulate network latency
    await new Promise(r => setTimeout(r, 10 + Math.random() * 50));

    if (subscription.endpoint.includes("expired") || Math.random() < FAIL_RATE) {
        const err: any = new Error("Received unexpected response code");
        err.statusCode = 410; // Gone
        throw err;
    }

    return Promise.resolve({ statusCode: 201 });
};

async function main() {
    console.log("🔔 Starting Notification Stress Test...");

    // 1. SETUP TEST USER
    const TEST_EMAIL = "notify-stress-test@example.com";

    // Cleanup previous
    const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (existing) {
        await prisma.$executeRawUnsafe(`DELETE FROM "PushSubscription" WHERE "userId" = '${existing.id}'`);
        await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
        data: {
            email: TEST_EMAIL,
            passwordHash: "hash",
            name: "Notify Tester",
            role: "REP"
        }
    });
    console.log(`Created User: ${user.id}`);

    // 2. SEED SUBSCRIPTIONS (Stress Test)
    const SUB_COUNT = 500;
    console.log(`Seeding ${SUB_COUNT} subscriptions...`);

    const subsData = [];
    for (let i = 0; i < SUB_COUNT; i++) {
        subsData.push({
            id: `sub_${i}_${Date.now()}`,
            userId: user.id,
            endpoint: `https://fake.push.service/${i}${i % 10 === 0 ? '_expired' : ''}`, // Force some to be explicitly 410
            p256dh: "fake_key",
            auth: "fake_auth"
        });
    }

    // Batch insert
    await prisma.pushSubscription.createMany({
        data: subsData
    });

    // 3. EMULATE DISPATCH LOGIC (From inbound/route.ts)
    console.log("🚀 Testing Dispatch Loop...");
    const startTime = Date.now();

    const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: user.id }
    });
    console.log(`Fetched ${subscriptions.length} subs from DB.`);

    const payload = { title: "Test", body: "Stress Test Message" };

    let successCount = 0;
    let expiredCount = 0;
    let errorCount = 0;

    // The Logic being tested:
    await Promise.all(subscriptions.map((sub) =>
        sendPushNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, payload).then(async (res) => {
            if (res.success) {
                successCount++;
            } else if (res.expired) {
                expiredCount++;
                // Simulate DB cleanup
                await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => { });
            } else {
                errorCount++;
            }
        })
    ));

    const duration = Date.now() - startTime;
    console.log(`\n--- RESULTS ---`);
    console.log(`Time: ${duration}ms`);
    console.log(`Sent: ${successCount}`);
    console.log(`Expired (Cleaned up): ${expiredCount}`);
    console.log(`Errors: ${errorCount}`);

    // 4. VERIFY CLEANUP
    const remaining = await prisma.pushSubscription.count({ where: { userId: user.id } });
    const expectedRemaining = SUB_COUNT - expiredCount;

    console.log(`\nDB Verification:`);
    console.log(`Remaining Records: ${remaining}`);
    console.log(`Expected: ${expectedRemaining}`);

    if (remaining === expectedRemaining) {
        console.log("✅ Cleanup Verified: Expired subscriptions were deleted.");
    } else {
        console.error("❌ Cleanup Failed: Count mismatch.");
        process.exit(1);
    }

    // 5. REAL NOTIFICATION TEST (Optional)
    // Try to find a real user to send to
    /*
    const realUser = await prisma.user.findFirst({
         where: { pushSubscriptions: { some: {} } },
         include: { pushSubscriptions: true }
    });

    if (realUser) {
        console.log(`\nFound real user with subs: ${realUser.email}`);
        console.log(`Sending REAL notification check integrity...`);
        MOCK_MODE = false; // Disable mock
        
        await sendPushNotification({
            endpoint: realUser.pushSubscriptions[0].endpoint,
            keys: { 
                p256dh: realUser.pushSubscriptions[0].p256dh, 
                auth: realUser.pushSubscriptions[0].auth 
            }
        }, { title: "Stress Test Complete", body: "The notification system passed verification." });
        console.log("Real notification sent.");
    }
    */

    // TEARDOWN
    console.log("Cleaning up...");
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
}

main().catch(console.error);
