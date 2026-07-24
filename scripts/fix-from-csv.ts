/**
 * Recover the real company names for the 714 "Unknown Company" leads by
 * matching phone numbers against the original Plumbers + Movers CSVs in
 * c:/Users/leoge/Downloads.
 *
 * Modes:
 *   DRY-RUN (default):  prints what it WOULD update, no writes.
 *   APPLY  (env APPLY=1): actually issues the UPDATEs in batched txns.
 */

import { prisma } from "../src/lib/prisma";
import { readFileSync } from "fs";
import { parseCSV } from "../src/lib/csv-parse";
import { normalizeToE164 } from "../src/lib/phone-utils";

const CSV_FILES = [
    "C:/Users/leoge/Downloads/Plumbers Final Leads - Sheet1.csv",
    "C:/Users/leoge/Downloads/Movers Final Leads - Sheet1.csv",
];

const APPLY = process.env.APPLY === "1";

function variants(raw: string): string[] {
    const e164 = normalizeToE164(raw);
    const out: string[] = [];
    if (e164) {
        out.push(e164);
        out.push(e164.replace(/^\+/, ""));
    }
    // Also index by digits-only suffix (length 9) so we catch CSV rows whose
    // leading 0 was stripped by Excel/Sheets — e.g. CSV "341089656" should
    // match DB "+61341089656".
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 9) out.push("DIGITS:" + digits.slice(-9));
    return out;
}

function lookupVariants(dbPhone: string): string[] {
    const out = [dbPhone];
    const digits = dbPhone.replace(/\D/g, "");
    if (digits.length >= 9) out.push("DIGITS:" + digits.slice(-9));
    return out;
}

async function main() {
    // 1. Build phone → company map from all CSVs (later files don't override earlier; prefer first hit).
    const phoneToCompany = new Map<string, { company: string; source: string }>();
    for (const file of CSV_FILES) {
        const text = readFileSync(file, "utf8");
        const rows = parseCSV(text);
        const headers = rows[0].map(h => h.trim());
        const businessCol = headers.findIndex(h => h.toLowerCase() === "business name" || h.toLowerCase() === "company name");
        const phoneCol = headers.findIndex(h => h.toLowerCase().includes("phone"));
        if (businessCol < 0 || phoneCol < 0) {
            console.warn(`[fix] skipping ${file}: missing business/phone col`);
            continue;
        }
        let added = 0;
        for (let i = 1; i < rows.length; i++) {
            const company = (rows[i][businessCol] ?? "").trim();
            if (!company) continue;
            for (const v of variants((rows[i][phoneCol] ?? "").trim())) {
                if (!phoneToCompany.has(v)) {
                    phoneToCompany.set(v, { company, source: file.split(/[\\/]/).pop()! });
                    added++;
                }
            }
        }
        console.log(`[fix] indexed ${added} unique phone variants from ${file.split(/[\\/]/).pop()}`);
    }

    // 2. Fetch all "Unknown Company" affected leads
    const affected = await prisma.lead.findMany({
        where: { companyName: "Unknown Company" },
        select: { id: true, phoneNumber: true, suburb: true, state: true },
    });
    console.log(`\n[fix] ${affected.length} affected 'Unknown Company' leads in DB.`);

    const matched: { id: string; phone: string; oldName: string; newName: string; source: string }[] = [];
    const unmatched: { phone: string; suburb: string | null; state: string | null }[] = [];

    for (const lead of affected) {
        let m: { company: string; source: string } | undefined;
        for (const v of lookupVariants(lead.phoneNumber)) {
            m = phoneToCompany.get(v);
            if (m) break;
        }
        if (m) {
            matched.push({ id: lead.id, phone: lead.phoneNumber, oldName: "Unknown Company", newName: m.company, source: m.source });
        } else {
            unmatched.push({ phone: lead.phoneNumber, suburb: lead.suburb, state: lead.state });
        }
    }

    console.log(`[fix] matched: ${matched.length}    unmatched: ${unmatched.length}`);
    console.log(`\n[fix] First 10 planned updates:`);
    for (const m of matched.slice(0, 10)) {
        console.log(`  ${m.phone}  →  "${m.newName}"  (from ${m.source})`);
    }

    if (unmatched.length > 0) {
        console.log(`\n[fix] First 10 UNMATCHED leads (no CSV row for these phones):`);
        for (const u of unmatched.slice(0, 10)) {
            console.log(`  ${u.phone}  state=${u.state ?? "-"}  suburb=${u.suburb ?? "-"}`);
        }
    }

    if (!APPLY) {
        console.log(`\n[fix] DRY RUN — no writes. Re-run with APPLY=1 to execute.`);
        return;
    }

    // 3. Apply
    console.log(`\n[fix] APPLY=1 — writing ${matched.length} updates in batches of 50…`);
    let done = 0;
    const BATCH = 50;
    for (let i = 0; i < matched.length; i += BATCH) {
        const slice = matched.slice(i, i + BATCH);
        await prisma.$transaction(
            slice.map(m =>
                prisma.lead.update({
                    where: { id: m.id },
                    data: { companyName: m.newName, updatedAt: new Date() },
                })
            )
        );
        done += slice.length;
        process.stdout.write(`\r[fix]   ${done}/${matched.length}`);
    }
    console.log(`\n[fix] Done.`);
    const after = await prisma.lead.count({ where: { companyName: "Unknown Company" } });
    console.log(`[fix] Remaining 'Unknown Company' rows: ${after}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
