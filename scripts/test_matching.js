require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
        }
    }
});

function normalizePhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("614") && digits.length === 11) {
        const local = "0" + digits.substring(2);
        const e164 = "+" + digits;
        return [e164, local, digits];
    }
    if (digits.startsWith("04") && digits.length === 10) {
        const e164 = "+61" + digits.substring(1);
        const raw = "61" + digits.substring(1);
        return [digits, e164, raw];
    }
    const variations = [digits];
    if (phone.startsWith("+")) variations.push(phone);
    return variations;
}

async function testMatch() {
    const phone = "+61405175314";
    const variations = normalizePhone(phone);
    console.log("Variations for", phone, ":", variations);

    const leadUnique = await prisma.lead.findUnique({
        where: { phoneNumber: phone }
    });
    console.log("FindUnique result:", leadUnique?.firstName || 'null');

    const leadFirst = await prisma.lead.findFirst({
        where: {
            phoneNumber: {
                in: variations
            }
        }
    });
    console.log("FindFirst variations result:", leadFirst?.firstName || 'null');

    const allLeads = await prisma.lead.findMany({ select: { phoneNumber: true, firstName: true } });
    console.log("All leads in DB:", allLeads.map(l => `${l.firstName}: ${l.phoneNumber}`));

    await prisma.$disconnect();
}

testMatch();
