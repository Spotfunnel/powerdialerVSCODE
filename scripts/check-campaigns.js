const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
    const campaigns = await p.campaign.findMany({ include: { _count: { select: { leads: true } } } });
    console.log("=== Campaigns ===");
    campaigns.forEach(c => console.log(`  ${c.name}: ${c._count.leads} leads`));

    console.log("\n=== Sample Recruiters leads ===");
    const sample = await p.lead.findMany({
        where: { campaign: { name: "Recruiters" } },
        take: 5,
        select: { companyName: true, phoneNumber: true, industry: true, state: true, status: true }
    });
    sample.forEach(r => console.log(`  ${r.companyName} | ${r.phoneNumber} | ${r.state} | ${r.status}`));

    const ready = await p.lead.count({ where: { campaign: { name: "Recruiters" }, status: "READY" } });
    console.log(`\nRecruiters with READY status: ${ready}`);
})().finally(() => p.$disconnect());
