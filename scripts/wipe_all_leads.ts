
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function wipeAllLeads() {
    console.log('🧹 Starting Full CRM Wipe...');

    try {
        // 1. Messages (Dependent on Conversations)
        const messages = await prisma.message.deleteMany({});
        console.log(`- Deleted ${messages.count} Messages`);

        // 2. Conversations (Dependent on Leads/Users)
        const conversations = await prisma.conversation.deleteMany({});
        console.log(`- Deleted ${conversations.count} Conversations`);

        // 3. Calls (Dependent on Leads/Users)
        const calls = await prisma.call.deleteMany({});
        console.log(`- Deleted ${calls.count} Calls`);

        // 4. Callbacks (Dependent on Leads)
        const callbacks = await prisma.callback.deleteMany({});
        console.log(`- Deleted ${callbacks.count} Callbacks`);

        // 5. Meetings (Dependent on Leads)
        const meetings = await prisma.meeting.deleteMany({});
        console.log(`- Deleted ${meetings.count} Meetings`);

        // 6. Last Interactions (Optional but good for clean slate)
        // Note: These don't link to Lead by ID, but by phone. Safe to wipe if we are wiping leads.
        const interactions = await prisma.lastInteractionMap.deleteMany({});
        console.log(`- Deleted ${interactions.count} Last Interaction Maps`);

        // 7. Finally Leads (The Root)
        const leads = await prisma.lead.deleteMany({});
        console.log(`✅ Pipeline Flushed! Deleted ${leads.count} Leads.`);

    } catch (error) {
        console.error('❌ Failed to wipe data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

wipeAllLeads();
