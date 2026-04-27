/**
 * Import Plumbers and Movers lead lists into separate campaigns.
 *
 * Sources:
 * - Plumbers Final Leads - Sheet1.csv (~1973 leads)
 * - Movers Final Leads - Sheet1.csv (~869 leads)
 *
 * Columns: Business Name, Phone, Website, Suburb, State
 * Phone format: "=+61 418 633 879" or "1800 86 5005" — needs cleanup
 *
 * Usage: node scripts/import-plumbers-movers.js
 * Requires: DATABASE_URL in .env
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

// Normalize AU phone numbers to +61 format
function normalizePhone(raw) {
    if (!raw) return null;
    let phone = String(raw).trim();
    // Remove leading = sign (Google Sheets formula artifact)
    phone = phone.replace(/^=/, "");
    // Remove all non-digit and non-plus characters
    phone = phone.replace(/[^0-9+]/g, "");
    if (!phone) return null;
    // Convert leading 0 to +61
    if (phone.startsWith("0")) {
        phone = "+61" + phone.slice(1);
    }
    // Add + prefix if starts with 61
    if (phone.startsWith("61") && !phone.startsWith("+")) {
        phone = "+" + phone;
    }
    // 1300/1800 numbers — keep as-is with + prefix
    if (phone.startsWith("1300") || phone.startsWith("1800")) {
        phone = "+" + phone;
    }
    if (phone.length < 10) return null;
    return phone;
}

// Truncate string to max length
function truncate(str, max) {
    if (!str) return str;
    return String(str).length > max ? String(str).slice(0, max) : String(str);
}

// Parse CSV with proper quote handling
function parseCSV(text) {
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length === 0) return [];

    const parseRow = (line) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = cols[idx] || "";
        });
        rows.push(obj);
    }
    return rows;
}

async function getOrCreateCampaign(name) {
    let campaign = await prisma.campaign.findFirst({ where: { name } });
    if (!campaign) {
        campaign = await prisma.campaign.create({ data: { name } });
        console.log(`  Created campaign: ${name} (${campaign.id})`);
    } else {
        console.log(`  Using existing campaign: ${name} (${campaign.id})`);
    }
    return campaign;
}

async function importBatch(leads, campaignId, label) {
    console.log(`\n=== Importing ${label}: ${leads.length} leads ===`);

    // Deduplicate by phone
    const phoneMap = new Map();
    leads.forEach(l => {
        if (l.phoneNumber) phoneMap.set(l.phoneNumber, l);
    });
    const unique = Array.from(phoneMap.values());
    console.log(`  After dedup: ${unique.length} unique phones`);

    // Find existing in DB
    const allPhones = unique.map(l => l.phoneNumber);
    const existing = new Set();
    for (let i = 0; i < allPhones.length; i += 500) {
        const batch = allPhones.slice(i, i + 500);
        const found = await prisma.lead.findMany({
            where: { phoneNumber: { in: batch } },
            select: { phoneNumber: true }
        });
        found.forEach(f => existing.add(f.phoneNumber));
    }
    console.log(`  Existing in DB: ${existing.size}`);

    const toCreate = unique.filter(l => !existing.has(l.phoneNumber));
    const toUpdate = unique.filter(l => existing.has(l.phoneNumber));
    console.log(`  New: ${toCreate.length}, Updates: ${toUpdate.length}`);

    // Batch create
    if (toCreate.length > 0) {
        const BATCH = 100;
        let created = 0;
        for (let i = 0; i < toCreate.length; i += BATCH) {
            const batch = toCreate.slice(i, i + BATCH).map(l => ({
                phoneNumber: l.phoneNumber,
                companyName: truncate(l.companyName, 200) || "Unknown",
                industry: truncate(l.industry, 200) || undefined,
                website: truncate(l.website, 500) || undefined,
                suburb: truncate(l.suburb, 100) || undefined,
                state: truncate(l.state, 20) || undefined,
                campaignId,
                source: "IMPORT_NEW",
                status: "READY"
            }));
            try {
                await prisma.lead.createMany({ data: batch, skipDuplicates: true });
                created += batch.length;
            } catch (err) {
                console.warn(`  Batch create at ${i} failed: ${err.message?.slice(0, 120)}`);
                for (const item of batch) {
                    try {
                        await prisma.lead.create({ data: item });
                        created++;
                    } catch { /* skip individual failures */ }
                }
            }
            process.stdout.write(`  Created ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length}\r`);
        }
        console.log(`  Created ${created} new leads`);
    }

    // Update existing (reassign to this campaign)
    if (toUpdate.length > 0) {
        const BATCH = 50;
        for (let i = 0; i < toUpdate.length; i += BATCH) {
            const batch = toUpdate.slice(i, i + BATCH);
            try {
                await prisma.$transaction(
                    batch.map(row =>
                        prisma.lead.update({
                            where: { phoneNumber: row.phoneNumber },
                            data: {
                                campaignId,
                                companyName: row.companyName || undefined,
                                industry: row.industry || undefined,
                                website: row.website || undefined,
                                suburb: row.suburb || undefined,
                                state: row.state || undefined,
                                source: "IMPORT_MERGE",
                                updatedAt: new Date()
                            }
                        })
                    )
                );
            } catch (err) {
                console.warn(`  Update batch at ${i} failed:`, err.message?.slice(0, 100));
            }
            process.stdout.write(`  Updated ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length}\r`);
        }
        console.log(`  Updated ${toUpdate.length} existing leads`);
    }
}

async function main() {
    console.log("=== Plumbers & Movers Import ===\n");

    // ─── 1. PLUMBERS ───
    console.log("1. Loading Plumbers CSV...");
    const plumberText = fs.readFileSync("C:/Users/leoge/Downloads/Plumbers Final Leads - Sheet1.csv", "utf8");
    const plumberData = parseCSV(plumberText);
    const plumberCampaign = await getOrCreateCampaign("Plumbers");

    const plumberLeads = plumberData
        .filter(r => r.Phone)
        .map(r => {
            const phone = normalizePhone(r.Phone);
            if (!phone) return null;
            return {
                phoneNumber: phone,
                companyName: r["Business Name"] || "Unknown",
                industry: "Plumber",
                website: r.Website || null,
                suburb: r.Suburb || null,
                state: r.State || null,
            };
        })
        .filter(Boolean);

    await importBatch(plumberLeads, plumberCampaign.id, "Plumbers");

    // ─── 2. MOVERS ───
    console.log("\n2. Loading Movers CSV...");
    const moverText = fs.readFileSync("C:/Users/leoge/Downloads/Movers Final Leads - Sheet1.csv", "utf8");
    const moverData = parseCSV(moverText);
    const moverCampaign = await getOrCreateCampaign("Movers");

    const moverLeads = moverData
        .filter(r => r.Phone)
        .map(r => {
            const phone = normalizePhone(r.Phone);
            if (!phone) return null;
            return {
                phoneNumber: phone,
                companyName: r["Business Name"] || "Unknown",
                industry: "Movers",
                website: r.Website || null,
                suburb: r.Suburb || null,
                state: r.State || null,
            };
        })
        .filter(Boolean);

    await importBatch(moverLeads, moverCampaign.id, "Movers");

    // ─── SUMMARY ───
    console.log("\n=== SUMMARY ===");
    const campaigns = await prisma.campaign.findMany({
        include: { _count: { select: { leads: true } } }
    });
    campaigns.forEach(c => {
        console.log(`  ${c.name}: ${c._count.leads} leads`);
    });

    const totalLeads = await prisma.lead.count();
    console.log(`\n  Total leads in DB: ${totalLeads}`);
}

main()
    .catch(e => { console.error("FATAL:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
