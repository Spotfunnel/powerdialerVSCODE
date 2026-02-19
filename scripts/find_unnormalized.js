const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Checking for non-normalized Lead phone numbers...");
        const leads = await prisma.lead.findMany({
            where: {
                NOT: {
                    phoneNumber: { startsWith: '+' }
                }
            }
        });

        console.log(`Found ${leads.length} non-normalized leads.`);
        leads.forEach(l => {
            console.log(`ID: ${l.id} | Phone: ${l.phoneNumber}`);
        });

        console.log("\nChecking for Conversation phone numbers...");
        const convs = await prisma.conversation.findMany({
            where: {
                NOT: {
                    contactPhone: { startsWith: '+' }
                }
            }
        });
        console.log(`Found ${convs.length} non-normalized conversations.`);
        convs.forEach(c => {
            console.log(`ID: ${c.id} | Phone: ${c.contactPhone}`);
        });

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
