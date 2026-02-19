
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/prisma"; // Direct DB access for setup
import 'dotenv/config';

const TARGET_URL = process.env.NEXTAUTH_URL || "https://www.getspotfunnel.com";
const SECRET = process.env.NEXTAUTH_SECRET;

async function main() {
    console.log(`\n🚀 STARTING PRODUCTION STRESS TEST`);
    console.log(`Target: ${TARGET_URL}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    if (!SECRET) {
        console.error("❌ Critical: NEXTAUTH_SECRET missing. Cannot sign token.");
        process.exit(1);
    }

    // 1. Setup Test User & Lead in DB (Direct DB access to bypass registration UI)
    console.log("--> Setting up Test Data in DB...");
    const testEmail = `stress-test-${Date.now()}@example.com`;
    const testPhone = `04${Math.floor(Math.random() * 100000000)}`;

    // Create/Find User (Simulating 'Leo' or 'Kye')
    // We'll use a real email format but it's a test user
    const user = await prisma.user.create({
        data: {
            email: testEmail,
            name: "Stress Test Bot",
            passwordHash: "hashtest",
            role: "SPECIALIST"
            // repPhoneNumber removed to avoid potential schema mismatch in test env
        }
    });

    console.log(`✅ Created Test User: ${user.email} (${user.id})`);

    // Create Lead to Book
    const lead = await prisma.lead.create({
        data: {
            firstName: "Stress",
            lastName: "Tester",
            companyName: "Load Test Inc",
            email: `lead-${Date.now()}@example.com`,
            phoneNumber: testPhone,
            status: "READY",
            state: "NSW"
        }
    });
    console.log(`✅ Created Test Lead: ${lead.firstName} (${lead.id})`);

    // 2. Forge Authentication Token
    console.log("\n--> Forging Session Token...");
    const token = await encode({
        token: {
            name: user.name,
            email: user.email,
            sub: user.id,
            id: user.id,
            role: user.role,
            repPhoneNumber: user.repPhoneNumber,
            picture: null
        },
        secret: SECRET,
    });

    // Cookie name depends on protocol. HTTPS = __Secure-next-auth.session-token
    const cookieName = TARGET_URL.startsWith("https") ? "__Secure-next-auth.session-token" : "next-auth.session-token";
    const cookieHeader = `${cookieName}=${token}`;

    console.log(`✅ Token Signed. Length: ${token.length}`);

    // 3. Test 1: Booking API (The fix we just deployed)
    console.log("\n--> Test 1: Attempting CRM Booking (POST /api/calendar/book)...");

    const bookingPayload = {
        specialist: "Leo", // Simulating Leo context
        start: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // Tomorrow
        end: new Date(Date.now() + 1000 * 60 * 60 * 25).toISOString(),
        name: "Stress Tester",
        email: lead.email,
        phone: lead.phoneNumber,
        notes: "Automated Stress Test Booking",
        leadId: lead.id
    };

    const res = await fetch(`${TARGET_URL}/api/calendar/book`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookieHeader
        },
        body: JSON.stringify(bookingPayload)
    });

    const verifyQueryTime = Date.now();
    console.log(`[Test] Booking API Status: ${res.status}`);
    const resText = await res.text();
    console.log(`[Test] Booking API Response: ${resText}`);

    if (res.status !== 200) {
        console.error("Booking API Failed. Terminating.");
        process.exit(1);
    }

    // If we reach here, status was 200
    try {
        const json = JSON.parse(resText); // Parse the text we already read
        console.log("[PASS] Booking API Success:", JSON.stringify(json, null, 2));
    } catch (e) {
        console.error("[FAIL] Booking API Success but response not valid JSON:", resText);
    }


    // 4. Verify Side Effects (DB Check)
    console.log("\n--> Verifying DB Records...");

    // Check Meeting
    const meeting = await prisma.meeting.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' }
    });

    if (meeting) {
        console.log(`[PASS] Meeting Record Created: ID ${meeting.id}`);
        console.log(`   - Provider: ${meeting.provider}`);
        console.log(`   - URL: ${meeting.meetingUrl}`);
        console.log(`   - EventId: ${meeting.externalEventId}`);
    } else {
        console.error("[FAIL] Meeting Record MISSING for leadId:", lead.id);
    }

    // Check Message (SMS)
    const message = await prisma.message.findFirst({
        where: { leadId: lead.id, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' }
    });

    if (message) {
        console.log(`[PASS] SMS Record Created: ${message.id}`);
        console.log(`   - Body: "${message.body}"`);
        if (message.body.includes("https://meet.google.com")) {
            console.log("   [PASS] Clean Link Detected");
        } else {
            console.warn("   [WARN] Link might be missing or verbose?");
        }
    } else {
        console.error("[FAIL] SMS Record MISSING");
    }

    // 5. Cleanup
    console.log("\n--> Cleanup...");
    await prisma.meeting.deleteMany({ where: { leadId: lead.id } });
    await prisma.message.deleteMany({ where: { leadId: lead.id } });
    await prisma.call.deleteMany({ where: { leadId: lead.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("[INFO] Cleanup Complete");

    console.log("\n[TEST SUMMARY]");
    if (meeting && message && res.status === 200) {
        console.log("[SUCCESS] End-to-End Booking Flow Verified on Production.");
    } else {
        console.log("[FAILURE] Some checks failed.");
    }
}

main().catch(e => console.error(e));
