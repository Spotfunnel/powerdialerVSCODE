/**
 * Import Australian Recruiters CSV into a "Recruiters" campaign.
 * Deduplicates by phone number and aggregates industries.
 *
 * Usage: node scripts/import-recruiters.js
 * Requires: DATABASE_URL in .env
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

function normalizePhone(raw) {
    if (!raw) return null;
    let phone = String(raw).trim();
    phone = phone.replace(/\D/g, "");
    if (!phone) return null;
    if (phone.startsWith("0")) {
        phone = "61" + phone.slice(1);
    }
    if (!phone.startsWith("+")) {
        phone = "+" + phone;
    }
    if (phone.length < 10) return null;
    return phone;
}

function truncate(str, max) {
    if (!str) return str;
    return String(str).length > max ? String(str).slice(0, max) : String(str);
}

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

async function main() {
    console.log("=== Recruiters Import ===\n");

    const csvPath = "C:/Users/leoge/Downloads/final_australian_recruiters_by_industry (1) - final_australian_recruiters_by_industry (1).csv";
    const text = fs.readFileSync(csvPath, "utf8");
    const rows = parseCSV(text);
    console.log(`Parsed ${rows.length} rows from CSV`);

    // Deduplicate by phone, aggregate industries
    const byPhone = new Map();
    let noPhone = 0;
    for (const row of rows) {
        const phone = normalizePhone(row["Phone"]);
        if (!phone) {
            noPhone++;
            continue;
        }
        if (byPhone.has(phone)) {
            const existing = byPhone.get(phone);
            if (row["Industry"] && !existing.industries.includes(row["Industry"])) {
                existing.industries.push(row["Industry"]);
            }
        } else {
            byPhone.set(phone, {
                phone,
                companyName: row["Company Name"] || "Unknown",
                email: row["Email"] || null,
                website: row["Website"] || null,
                state: row["State"] || null,
                profileUrl: row["Profile URL"] || null,
                industries: row["Industry"] ? [row["Industry"]] : [],
            });
        }
    }
    console.log(`Unique phones: ${byPhone.size} (skipped ${noPhone} rows with no phone)`);

    // Create campaign
    let campaign = await prisma.campaign.findFirst({ where: { name: "Recruiters" } });
    if (!campaign) {
        campaign = await prisma.campaign.create({ data: { name: "Recruiters" } });
        console.log(`Created campaign: Recruiters (${campaign.id})`);
    } else {
        console.log(`Using existing campaign: Recruiters (${campaign.id})`);
    }

    // Build leads array
    const leads = Array.from(byPhone.values()).map(r => ({
        phoneNumber: r.phone,
        companyName: truncate(r.companyName, 200),
        firstName: r.companyName.split(/\s+/)[0] || "Friend",
        lastName: "",
        industry: truncate(r.industries.join(", "), 200) || "Recruitment",
        notes: truncate(r.profileUrl ? `Profile: ${r.profileUrl}\nServices: ${r.industries.join(", ")}` : `Services: ${r.industries.join(", ")}`, 2000),
        email: truncate(r.email, 200),
        website: truncate(r.website, 500),
        state: truncate(r.state, 20),
        suburb: null,
        postcode: null,
    }));

    // Check existing
    const allPhones = leads.map(l => l.phoneNumber);
    const existing = new Set();
    for (let i = 0; i < allPhones.length; i += 500) {
        const batch = allPhones.slice(i, i + 500);
        const found = await prisma.lead.findMany({
            where: { phoneNumber: { in: batch } },
            select: { phoneNumber: true }
        });
        found.forEach(f => existing.add(f.phoneNumber));
    }
    console.log(`Existing in DB: ${existing.size}`);

    const toCreate = leads.filter(l => !existing.has(l.phoneNumber));
    const toUpdate = leads.filter(l => existing.has(l.phoneNumber));
    console.log(`New: ${toCreate.length}, Updates: ${toUpdate.length}`);

    // Batch create
    if (toCreate.length > 0) {
        const BATCH = 100;
        let created = 0;
        for (let i = 0; i < toCreate.length; i += BATCH) {
            const batch = toCreate.slice(i, i + BATCH).map(l => ({
                phoneNumber: l.phoneNumber,
                companyName: l.companyName || "Unknown",
                firstName: l.firstName || undefined,
                lastName: l.lastName || undefined,
                industry: l.industry || undefined,
                notes: l.notes || undefined,
                email: l.email || undefined,
                website: l.website || undefined,
                suburb: l.suburb || undefined,
                state: l.state || undefined,
                postcode: l.postcode || undefined,
                campaignId: campaign.id,
                source: "IMPORT_NEW",
                status: "READY"
            }));
            try {
                await prisma.lead.createMany({ data: batch, skipDuplicates: true });
                created += batch.length;
            } catch (err) {
                console.warn(`Batch create at ${i} failed: ${err.message?.slice(0, 120)}`);
                for (const item of batch) {
                    try {
                        await prisma.lead.create({ data: item });
                        created++;
                    } catch { /* skip */ }
                }
            }
            process.stdout.write(`  Created ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length}\r`);
        }
        console.log(`Created ${created} new leads`);
    }

    // Update existing leads to assign to this campaign
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
                                campaignId: campaign.id,
                                companyName: row.companyName || undefined,
                                industry: row.industry || undefined,
                                notes: row.notes || undefined,
                                email: row.email || undefined,
                                website: row.website || undefined,
                                state: row.state || undefined,
                                source: "IMPORT_MERGE",
                                updatedAt: new Date()
                            }
                        })
                    )
                );
            } catch (err) {
                console.warn(`Update batch at ${i} failed:`, err.message?.slice(0, 100));
            }
            process.stdout.write(`  Updated ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length}\r`);
        }
        console.log(`Updated ${toUpdate.length} existing leads`);
    }

    // Summary
    console.log("\n=== SUMMARY ===");
    const campaigns = await prisma.campaign.findMany({
        include: { _count: { select: { leads: true } } }
    });
    campaigns.forEach(c => {
        console.log(`  ${c.name}: ${c._count.leads} leads`);
    });
    const total = await prisma.lead.count();
    console.log(`\n  Total leads in DB: ${total}`);
}

main()
    .catch(e => { console.error("FATAL:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
