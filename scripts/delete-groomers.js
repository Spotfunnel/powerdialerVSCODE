const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
    const campaign = await p.campaign.findFirst({ where: { name: "Vets & Groomers" } });
    if (!campaign) { console.log("Campaign not found!"); return; }

    const result = await p.lead.deleteMany({
        where: { campaignId: campaign.id, industry: "Groomer" }
    });
    console.log(`Deleted ${result.count} groomers`);

    const remaining = await p.lead.count({ where: { campaignId: campaign.id } });
    console.log(`Remaining in Vets & Groomers: ${remaining}`);
})().finally(() => p.$disconnect());
