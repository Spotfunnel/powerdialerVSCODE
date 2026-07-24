/**
 * Read-only: scan every CSV in c:/Users/leoge/Downloads, match each one's
 * phone column against the 714 affected "Unknown Company" leads, and
 * report which file is the import source.
 */

import { prisma } from "../src/lib/prisma";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { parseCSV } from "../src/lib/csv-parse";
import { normalizeToE164 } from "../src/lib/phone-utils";

const DOWNLOADS = "C:/Users/leoge/Downloads";

function variants(raw: string): string[] {
    const e164 = normalizeToE164(raw);
    if (!e164) return [];
    const noplus = e164.replace(/^\+/, "");
    return [e164, noplus];
}

function findCsvs(dir: string, depth = 2): string[] {
    if (depth < 0) return [];
    let out: string[] = [];
    try {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            try {
                const s = statSync(p);
                if (s.isDirectory()) out = out.concat(findCsvs(p, depth - 1));
                else if (name.toLowerCase().endsWith(".csv")) out.push(p);
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
    return out;
}

async function main() {
    const affected = await prisma.lead.findMany({
        where: { companyName: "Unknown Company" },
        select: { phoneNumber: true },
    });
    const affectedSet = new Set(affected.map(l => l.phoneNumber));
    console.log(`[match] ${affectedSet.size} affected phones in DB.\n`);

    const files = findCsvs(DOWNLOADS, 2);
    const scores: { file: string; hits: number; total: number; headers: string[] }[] = [];

    for (const file of files) {
        let text: string;
        try { text = readFileSync(file, "utf8"); } catch { continue; }
        let rows: string[][];
        try { rows = parseCSV(text); } catch { continue; }
        if (rows.length < 2) continue;

        const headers = rows[0].map(h => h.trim());
        const phoneCols = headers
            .map((h, i) => h.toLowerCase().includes("phone") || h.toLowerCase() === "phone" ? i : -1)
            .filter(i => i > -1);
        if (phoneCols.length === 0) continue;

        let hits = 0;
        const totalRows = rows.length - 1;
        for (let i = 1; i < rows.length; i++) {
            for (const c of phoneCols) {
                for (const v of variants((rows[i][c] ?? "").trim())) {
                    if (affectedSet.has(v)) { hits++; break; }
                }
            }
        }
        if (hits > 0) {
            scores.push({ file, hits, total: totalRows, headers });
        }
    }

    scores.sort((a, b) => b.hits - a.hits);
    console.log(`[match] CSVs with at least 1 match (top 10):`);
    for (const s of scores.slice(0, 10)) {
        console.log(`  ${s.hits}/${affectedSet.size} matched  (CSV rows: ${s.total})  → ${s.file}`);
        console.log(`    headers: ${s.headers.slice(0, 12).join(" | ")}${s.headers.length > 12 ? " | …" : ""}`);
    }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
