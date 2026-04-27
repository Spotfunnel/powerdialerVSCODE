/**
 * Bulk import leads from 3 files into separate campaigns:
 * 1. Therapists (XLSX) - psychology_today_australia_ENRICHED.xlsx
 * 2. Chiropractors (CSV) - chiropractors_australia_enriched.csv
 * 3. Vets & Groomers (XLSX) - Vets _ Grommers Leads .xlsx
 *
 * Usage: node scripts/import-lead-lists.js
 * Requires: DATABASE_URL in .env
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// Normalize AU phone numbers to +61 format
function normalizePhone(raw) {
    if (!raw) return null;
    let phone = String(raw).trim();
    // Remove all non-digit characters
    phone = phone.replace(/\D/g, "");
    if (!phone) return null;
    // Convert leading 0 to +61
    if (phone.startsWith("0")) {
        phone = "61" + phone.slice(1);
    }
    // Add + prefix if not present
    if (!phone.startsWith("+")) {
        phone = "+" + phone;
    }
    // Minimum valid AU phone: +61XXXXXXXXX (12 chars) but be lenient for landlines
    if (phone.length < 10) return null;
    return phone;
}

// Truncate string to max length (prevent index overflow)
function truncate(str, max) {
    if (!str) return str;
    return String(str).length > max ? String(str).slice(0, max) : String(str);
}

// Split a full name into first/last
function splitName(fullName) {
    if (!fullName) return { firstName: "Friend", lastName: "" };
    const parts = fullName.trim().split(/\s+/);
    // Remove common prefixes
    const prefixes = ["Dr", "Dr.", "Prof", "Prof.", "Mr", "Mrs", "Ms", "Miss"];
    if (parts.length > 1 && prefixes.includes(parts[0])) {
        parts.shift();
    }
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// Parse location string like "Wollongong, NSW 2500"
function parseLocation(loc) {
    if (!loc) return {};
    const match = loc.match(/^(.+?),\s*([A-Z]{2,3})\s*(\d{4})?$/);
    if (match) {
        return { suburb: match[1].trim(), state: match[2], postcode: match[3] || null };
    }
    return { suburb: loc.trim() };
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

// Read XLSX using xlsx-cli (already available via npx)
function readXLSX(filePath) {
    const { execSync } = require("child_process");
    const json = execSync(`npx xlsx-cli -J "${filePath}"`, {
        maxBuffer: 50 * 1024 * 1024,
        encoding: "utf8"
    });
    return JSON.parse(json);
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

    // Find existing
    const allPhones = unique.map(l => l.phoneNumber);
    // Check in batches of 500 to avoid query size limits
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
                firstName: truncate(l.firstName, 100) || undefined,
                lastName: truncate(l.lastName, 100) || undefined,
                industry: truncate(l.industry, 200) || undefined,
                notes: truncate(l.notes, 2000) || undefined,
                email: truncate(l.email, 200) || undefined,
                website: truncate(l.website, 500) || undefined,
                suburb: truncate(l.suburb, 100) || undefined,
                state: truncate(l.state, 20) || undefined,
                postcode: truncate(l.postcode, 10) || undefined,
                campaignId,
                source: "IMPORT_NEW",
                status: "READY"
            }));
            try {
                await prisma.lead.createMany({ data: batch, skipDuplicates: true });
                created += batch.length;
            } catch (err) {
                console.warn(`\n  Batch create at ${i} failed: ${err.message?.slice(0, 120)}`);
                // Try one-by-one for failed batch
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

    // Batch update existing (assign to campaign + update fields)
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
                                firstName: row.firstName || undefined,
                                lastName: row.lastName || undefined,
                                notes: row.notes || undefined,
                                industry: row.industry || undefined,
                                email: row.email || undefined,
                                website: row.website || undefined,
                                suburb: row.suburb || undefined,
                                state: row.state || undefined,
                                postcode: row.postcode || undefined,
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
    console.log("=== Lead Import Script ===\n");

    // ─── 1. THERAPISTS ───
    console.log("1. Loading Therapists XLSX...");
    const therapistData = readXLSX("C:/Users/leoge/Downloads/psychology_today_australia_ENRICHED.xlsx");
    const therapistCampaign = await getOrCreateCampaign("Therapists");

    const therapistLeads = therapistData
        .filter(r => r.Phone)
        .map(r => {
            const phone = normalizePhone(r.Phone);
            if (!phone) return null;
            const { firstName, lastName } = splitName(r.Name);
            const loc = parseLocation(r.Location);
            const notesParts = [];
            if (r.Title) notesParts.push(r.Title);
            if (r.Specialties) notesParts.push("Specialties: " + r.Specialties);
            return {
                phoneNumber: phone,
                companyName: r.Name || "Unknown",
                firstName,
                lastName,
                industry: r.Title || null,
                notes: notesParts.join("\n") || null,
                email: r.Email || null,
                website: r.Website || null,
                suburb: loc.suburb || null,
                state: loc.state || r.State || null,
                postcode: loc.postcode || null,
            };
        })
        .filter(Boolean);

    await importBatch(therapistLeads, therapistCampaign.id, "Therapists");

    // ─── 2. CHIROPRACTORS ───
    console.log("\n2. Loading Chiropractors CSV...");
    const chiroText = fs.readFileSync("C:/Users/leoge/Downloads/chiropractors_australia_enriched.csv", "utf8");
    const chiroData = parseCSV(chiroText);
    const chiroCampaign = await getOrCreateCampaign("Chiropractors");

    const chiroLeads = chiroData
        .filter(r => r.Phone)
        .map(r => {
            const phone = normalizePhone(r.Phone);
            if (!phone) return null;
            const { firstName, lastName } = splitName(r.Name);
            const notesParts = [];
            if (r.Techniques) notesParts.push("Techniques: " + r.Techniques.replace(/;/g, ", "));
            if (r.Specialties) notesParts.push("Specialties: " + r.Specialties);
            return {
                phoneNumber: phone,
                companyName: r.Clinic || r.Name || "Unknown",
                firstName,
                lastName,
                industry: "Chiropractor",
                notes: notesParts.join("\n") || null,
                email: r.Email || null,
                website: r.Website || null,
                suburb: r.Suburb || null,
                state: r.State || null,
                postcode: r.Postcode ? String(Math.round(parseFloat(r.Postcode))) : null,
            };
        })
        .filter(Boolean);

    await importBatch(chiroLeads, chiroCampaign.id, "Chiropractors");

    // ─── 3. VETS & GROOMERS ───
    console.log("\n3. Loading Vets & Groomers XLSX...");
    const vetData = readXLSX("C:/Users/leoge/Downloads/Vets _ Grommers Leads .xlsx");
    const vetCampaign = await getOrCreateCampaign("Vets & Groomers");

    const vetLeads = vetData
        .filter(r => r.Number)
        .map(r => {
            const phone = normalizePhone(r.Number);
            if (!phone) return null;
            return {
                phoneNumber: phone,
                companyName: r.Name || "Unknown",
                firstName: r.Name || "Friend",
                lastName: "",
                industry: r.Type || null, // "Vet" or "Groomer"
                notes: r.Type ? `Type: ${r.Type}` : null,
                email: (r.Email && r.Email !== "user@domain.com") ? r.Email : null,
                website: r.Website || null,
                suburb: null,
                state: null,
                postcode: null,
            };
        })
        .filter(Boolean);

    await importBatch(vetLeads, vetCampaign.id, "Vets & Groomers");

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
