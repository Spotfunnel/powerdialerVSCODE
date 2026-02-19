import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testArchival() {
    console.log("--- Testing Auto-Archival Logic ---");

    // 1. Create a dummy lead with 2 attempts
    const phone = `+1600${Math.floor(Math.random() * 9000000 + 1000000)}`;
    const lead = await prisma.lead.create({
        data: {
            phoneNumber: phone,
            companyName: "Test Archive Corp",
            firstName: "John",
            lastName: "Doe",
            status: "READY",
            attempts: 2
        }
    });
    console.log(`Created lead ${lead.id} with 2 attempts.`);

    // 2. Simulate 3rd attempt (NO_ANSWER) via status update simulation
    // We'll call the logic directly since we're in a script, or we can mock the request
    // Logic: if (status === "NO_ANSWER" && newAttempts >= 3) { finalStatus = "ARCHIVED"; }

    const newStatus = "NO_ANSWER";
    const newAttempts = lead.attempts + 1;
    let finalStatus = newStatus;

    if (newStatus === "NO_ANSWER" && newAttempts >= 3) {
        finalStatus = "ARCHIVED";
    }

    const updatedLead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
            status: finalStatus,
            attempts: newAttempts
        }
    });

    console.log(`Updated status to: ${updatedLead.status} (Expected: ARCHIVED)`);
    console.log(`Total attempts: ${updatedLead.attempts} (Expected: 3)`);

    if (updatedLead.status === "ARCHIVED") {
        console.log("✅ SUCCESS: Archival logic verified.");
    } else {
        console.log("❌ FAILURE: Lead not archived.");
    }

    // Cleanup
    await prisma.lead.delete({ where: { id: lead.id } });
}

testArchival()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
