/**
 * Imports three SMS-ready CSVs from Downloads into three new campaigns.
 *
 * Mirrors the logic in src/app/api/crm/import/route.ts but skips the HTTP
 * layer (and session/CSRF) by going straight at Prisma. Uses the shared
 * parseCSV / mapImportHeaders / normalizeToE164 helpers so behavior is
 * identical to a UI-driven upload.
 *
 * Run:
 *   npx tsx scripts/import-sms-csvs.ts
 */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma";
import { parseCSV, mapImportHeaders } from "../src/lib/csv-parse";
import { normalizeToE164 } from "../src/lib/phone-utils";
import { fallbackCompanyName } from "../src/lib/lead-display";
import { LeadStatus } from "../src/lib/types";

const SOURCES: { campaignName: string; csvPath: string }[] = [
  { campaignName: "Pool",    csvPath: "C:/Users/leoge/Downloads/leads_pool.csv" },
  { campaignName: "Roofers", csvPath: "C:/Users/leoge/Downloads/leads_roofers.csv" },
  { campaignName: "HVAC",    csvPath: "C:/Users/leoge/Downloads/leads_hvac.csv" },
];

async function ensureCampaign(name: string): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.campaign.findFirst({ where: { name } });
  if (existing) return { id: existing.id, created: false };
  const created = await prisma.campaign.create({ data: { name, region: "AU" } });
  return { id: created.id, created: true };
}

async function importCsv(campaignId: string, csvPath: string) {
  const text = fs.readFileSync(csvPath, "utf8");
  const parsedRows = parseCSV(text);
  if (parsedRows.length === 0) return { count: 0, created: 0, updated: 0, skipped: 0 };

  const headers = parsedRows[0].map((h) => h.trim());
  const colMap = mapImportHeaders(headers);
  if (colMap.phone === -1) throw new Error(`${csvPath}: no 'phone' column`);

  let skipped = 0;
  const processedRows: any[] = [];
  for (let i = 1; i < parsedRows.length; i++) {
    const cols = parsedRows[i].map((c) => c.trim());
    const rawPhone = cols[colMap.phone];
    if (!rawPhone) { skipped++; continue; }
    const phone = normalizeToE164(rawPhone);
    if (!phone || phone.length < 10) { skipped++; continue; }

    const rawCompany = colMap.company > -1 ? cols[colMap.company]?.trim() : "";
    const hasCompanyName = !!rawCompany;
    const companyName = hasCompanyName ? rawCompany! : fallbackCompanyName({ phoneNumber: phone });

    processedRows.push({
      phoneNumber: phone,
      companyName,
      hasCompanyName,
      firstName: colMap.first > -1 ? (cols[colMap.first] || undefined) : undefined,
      lastName: colMap.last > -1 ? (cols[colMap.last] || "") : "",
      employees: colMap.employees > -1 ? (parseInt(cols[colMap.employees]) || 0) : 0,
      priority: colMap.priority > -1 ? (cols[colMap.priority].toUpperCase().includes("A") ? "A" : "B") : "B",
      email: colMap.email > -1 ? cols[colMap.email] : null,
      suburb: colMap.suburb > -1 ? cols[colMap.suburb] : (colMap.location > -1 ? cols[colMap.location] : undefined),
      state: colMap.state > -1 ? cols[colMap.state] : undefined,
      website: colMap.website > -1 ? cols[colMap.website] : undefined,
      status: LeadStatus.READY,
      source: "IMPORT",
      campaignId,
    });
  }

  // Dedupe within file by phone (last occurrence wins)
  const byPhone = new Map<string, any>();
  for (const row of processedRows) byPhone.set(row.phoneNumber, row);
  const uniqueRows = Array.from(byPhone.values());

  const phones = uniqueRows.map((r) => r.phoneNumber);
  const existingLeads = await prisma.lead.findMany({
    where: { phoneNumber: { in: phones } },
    select: { phoneNumber: true },
  });
  const existingSet = new Set(existingLeads.map((l) => l.phoneNumber));

  const toCreate: any[] = [];
  const toUpdate: any[] = [];
  for (const row of uniqueRows) {
    if (existingSet.has(row.phoneNumber)) toUpdate.push(row);
    else {
      const { hasCompanyName: _drop, ...persisted } = row;
      toCreate.push({ ...persisted, source: "IMPORT_NEW" });
    }
  }

  if (toCreate.length > 0) {
    await prisma.lead.createMany({ data: toCreate, skipDuplicates: true } as any);
  }

  let updated = 0;
  const BATCH = 50;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((row) =>
        prisma.lead.update({
          where: { phoneNumber: row.phoneNumber },
          data: {
            ...(row.hasCompanyName ? { companyName: row.companyName } : {}),
            firstName: row.firstName || undefined,
            lastName: row.lastName || undefined,
            email: row.email || undefined,
            suburb: row.suburb || undefined,
            state: row.state || undefined,
            source: "IMPORT_MERGE",
            campaignId: row.campaignId,
            updatedAt: new Date(),
          } as any,
        })
      )
    );
    updated += batch.length;
  }

  return { count: uniqueRows.length, created: toCreate.length, updated, skipped };
}

async function main() {
  for (const s of SOURCES) {
    const { id, created } = await ensureCampaign(s.campaignName);
    console.log(`\n[campaign] "${s.campaignName}" id=${id} ${created ? "CREATED" : "REUSED"}`);
    const res = await importCsv(id, s.csvPath);
    console.log(`  rows=${res.count}  created=${res.created}  updated=${res.updated}  skipped=${res.skipped}`);
  }
}

main()
  .catch((e) => { console.error("[import] FAILED:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
