const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' }); // Try .env.local first for Next.js app
const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting Messaging Stress Test...");

    // 1. Create or Find a Test Lead
    const phone = "+61400000000";
    let lead = await prisma.lead.findFirst({ where: { phoneNumber: phone } });

    if (!lead) {
        console.log("Creating Test Lead...");
        lead = await prisma.lead.create({
            data: {
                firstName: "Stress",
                lastName: "Tester",
                companyName: "Load Gen Corp",
                phoneNumber: phone,
                email: "stress@test.com",
                status: "NEW"
            }
        });
    } else {
        console.log("Found existing Test Lead:", lead.id);
    }

    // 2. Ensure Conversation Exists
    let conversation = await prisma.conversation.findFirst({
        where: { contactId: lead.id }
    });

    if (!conversation) {
        console.log("Creating Conversation...");
        conversation = await prisma.conversation.create({
            data: {
                contactId: lead.id,
                contactPhone: phone,
                status: "OPEN",
                unreadCount: 0,
                lastMessageAt: new Date()
            }
        });
    }

    // 3. Bulk Seed History (Simulate 50 past messages)
    console.log("💥 Seeding 50 past messages...");
    const pastMessages = [];
    for (let i = 0; i < 50; i++) {
        const isInbound = i % 2 === 0;
        pastMessages.push({
            conversationId: conversation.id,
            direction: isInbound ? "INBOUND" : "OUTBOUND",
            fromNumber: isInbound ? phone : "SYSTEM",
            toNumber: isInbound ? "SYSTEM" : phone,
            body: `Historical message ${i} - Stress Test`,
            status: "DELIVERED",
            leadId: lead.id,
            createdAt: new Date(Date.now() - (1000 * 60 * (50 - i))) // Minutes ago
        });
    }

    await prisma.message.createMany({ data: pastMessages });
    console.log("✅ History Seeded.");

    // 4. Live Simulation Loop
    console.log("⚡ Starting LIVE simulation loop (Press Ctrl+C to stop)");
    console.log("   --> Open /messaging and /dialer tabs NOW to verify sync.");

    let count = 1;
    setInterval(async () => {
        const isInbound = Math.random() > 0.5;
        const body = `Live Stream Message #${count} [${isInbound ? 'INCOMING' : 'OUTGOING'}] - ${new Date().toLocaleTimeString()}`;

        // Create Message
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                direction: isInbound ? "INBOUND" : "OUTBOUND",
                fromNumber: isInbound ? phone : "SYSTEM",
                toNumber: isInbound ? "SYSTEM" : phone,
                body: body,
                status: isInbound ? "RECEIVED" : "SENT",
                leadId: lead.id,
            }
        });

        // Update Conversation (Critical for inbox sorting/unread)
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                unreadCount: isInbound ? { increment: 1 } : 0, // Reset if we reply, increment if they reply? 
                // Actually, logic is: Inbound increments. Outbound usually resets or leaves as is.
                // For this test, let's strictly increment on inbound.
            }
        });

        console.log(`[${new Date().toLocaleTimeString()}] injected ${isInbound ? 'Values' : 'Response'}: "${body}"`);
        count++;

    }, 2000); // Every 2 seconds
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
