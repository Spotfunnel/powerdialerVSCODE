/**
 * Remove big companies (>5 service listings) from the Recruiters campaign.
 * Usage: node scripts/cleanup-recruiters.js
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

function normalizePhone(raw) {
    if (!raw) return null;
    let phone = String(raw).trim().replace(/\D/g, "");
    if (!phone) return null;
    if (phone.startsWith("0")) phone = "61" + phone.slice(1);
    if (!phone.startsWith("+")) phone = "+" + phone;
    if (phone.length < 10) return null;
    return phone;
}

function parseCSV(text) {
    const lines = text.split("\n").filter(l => l.trim());
    const parseRow = (line) => {
        const result = []; let current = ""; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
            else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
            else { current += ch; }
        }
        result.push(current.trim());
        return result;
    };
    const headers = parseRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = cols[idx] || ""; });
        rows.push(obj);
    }
    return rows;
}

async function main() {
    const csvPath = "C:/Users/leoge/Downloads/final_australian_recruiters_by_industry (1) - final_australian_recruiters_by_industry (1).csv";
    const text = fs.readFileSync(csvPath, "utf8");
    const rows = parseCSV(text);

    // Count services per phone
    const phoneCounts = new Map();
    for (const row of rows) {
        const phone = normalizePhone(row["Phone"]);
        if (!phone) continue;
        phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
    }

    // Phones with >5 services = big companies
    const toDelete = [];
    for (const [phone, count] of phoneCounts) {
        if (count > 5) toDelete.push(phone);
    }
    console.log(`Phones to delete (>5 services): ${toDelete.length}`);

    const campaign = await prisma.campaign.findFirst({ where: { name: "Recruiters" } });
    if (!campaign) { console.log("No Recruiters campaign found!"); return; }

    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        const result = await prisma.lead.deleteMany({
            where: {
                phoneNumber: { in: batch },
                campaignId: campaign.id
            }
        });
        deleted += result.count;
    }
    console.log(`Deleted ${deleted} leads from Recruiters campaign`);

    const remaining = await prisma.lead.count({ where: { campaignId: campaign.id } });
    console.log(`Remaining Recruiters leads: ${remaining}`);
    const total = await prisma.lead.count();
    console.log(`Total leads in DB: ${total}`);
}

main()
    .catch(e => { console.error("FATAL:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
