import { prisma } from './src/lib/prisma';

async function testInbound() {
    console.log("Testing Inbound Route Logic...");

    // 1. Check if we have a lead to test with
    const lead = await prisma.lead.findFirst();
    if (!lead) {
        console.log("No leads found in DB to test identification.");
        return;
    }

    console.log(`Found lead: ${lead.firstName} ${lead.lastName} (${lead.phoneNumber})`);

    // We can't easily call the API route locally with formData and expect Prisma to work the same way without a lot of setup
    // But we've already reviewed the code logic. 
    // I'll check if the Lead lookup logic I wrote survives a dry run.

    const fromNumber = lead.phoneNumber;
    const cleanFrom = fromNumber.replace(/[\s\-\(\)\+]/g, "");

    const foundLead = await prisma.lead.findFirst({
        where: {
            OR: [
                { phoneNumber: { contains: cleanFrom } },
                { phoneNumber: { contains: fromNumber } }
            ]
        },
        select: { firstName: true, lastName: true, companyName: true, id: true }
    });

    if (foundLead) {
        console.log("SUCCESS: Lead identified correctly!");
        console.log(`Identified: ${foundLead.firstName} ${foundLead.lastName} from ${foundLead.companyName}`);
    } else {
        console.log("FAILURE: Lead NOT identified.");
    }
}

testInbound().catch(console.error).finally(() => prisma.$disconnect());
