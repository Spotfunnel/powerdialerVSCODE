require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const directUrl = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: directUrl
        }
    }
});

async function verify() {
    console.log("\n========================================");
    console.log("   POWER DIALER - STRESS TEST AUDIT");
    console.log("========================================\n");

    try {
        // 1. Stress Test Data
        const stressActivities = await prisma.leadActivity.count({
            where: { content: { contains: 'Race condition test' } }
        });
        const stressMessages = await prisma.message.count({
            where: { body: { contains: 'Race condition test' } }
        });

        console.log(`[STRESS] Activities Found: ${stressActivities}`);
        console.log(`[STRESS] Messages Found:   ${stressMessages}`);

        // 2. Sample Verification
        if (stressMessages > 0) {
            const sampleMsg = await prisma.message.findFirst({
                where: { body: { contains: 'Race condition test' } },
                orderBy: { createdAt: 'desc' },
                include: { conversation: true }
            });
            console.log("\n[SAMPLE MESSAGE]");
            console.log(`- ID: ${sampleMsg.id}`);
            console.log(`- From: ${sampleMsg.fromNumber}`);
            console.log(`- Lead ID: ${sampleMsg.leadId || 'NULL'}`);
            console.log(`- Conv Status: ${sampleMsg.conversation?.status}`);
        }

        // 3. Global Stats
        const counts = {
            users: await prisma.user.count(),
            leads: await prisma.lead.count(),
            messages: await prisma.message.count(),
            conversations: await prisma.conversation.count(),
            activities: await prisma.leadActivity.count()
        };
        console.log("\n[GLOBAL STATS]");
        console.log(JSON.stringify(counts, null, 2));

        console.log("\n========================================\n");

    } catch (err) {
        console.error("Verification Error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
