/**
 * Repair leads whose phoneNumber was stored with US country code (+1300xxx /
 * +1800xxx) instead of the correct AU E.164 form (+611300xxx / +611800xxx).
 *
 * Twilio rejected outbound dials to these numbers with error 13224
 * ("invalid phone number") because +1300xxxxxx looks like a malformed US
 * number (only 10 digits after +1, well short of the 10-digit subscriber
 * number a US E.164 needs).
 *
 * Strategy:
 *   1. For phones whose corrected form already exists on a different lead
 *      (a duplicate from a parallel import), delete the broken row — both
 *      copies represent the same business and the unbroken one is the keep.
 *   2. For all other broken rows, UPDATE phoneNumber in place to the correct
 *      "+61" + digits form.
 *
 * Modes:
 *   DRY-RUN (default): prints planned operations, no writes.
 *   APPLY=1          : executes the deletes + updates in batched transactions.
 */

import { prisma } from "../src/lib/prisma";

const APPLY = process.env.APPLY === "1";

type Broken = { id: string; bad: string; fixed: string; companyName: string };

async function main() {
    const broken = await prisma.$queryRaw<Broken[]>`
        SELECT id, "phoneNumber" AS bad,
               '+61' || REGEXP_REPLACE("phoneNumber", '^\\+', '') AS fixed,
               "companyName"
          FROM "Lead"
         WHERE "phoneNumber" ~ '^\\+1(300|800)[0-9]{6,7}$'
    `;
    console.log(`[fix] ${broken.length} leads with malformed +1300/+1800 phones.`);
    if (broken.length === 0) return;

    // Identify collisions
    const fixedNumbers = broken.map(b => b.fixed);
    const existing = await prisma.lead.findMany({
        where: { phoneNumber: { in: fixedNumbers } },
        select: { id: true, phoneNumber: true, companyName: true },
    });
    const existingByPhone = new Map(existing.map(e => [e.phoneNumber, e]));

    const toDelete: Broken[] = [];
    const toUpdate: Broken[] = [];
    for (const b of broken) {
        const collision = existingByPhone.get(b.fixed);
        if (collision && collision.id !== b.id) {
            toDelete.push(b);
        } else {
            toUpdate.push(b);
        }
    }
    console.log(`[fix] toUpdate: ${toUpdate.length}    toDelete (collisions): ${toDelete.length}`);

    if (toDelete.length > 0) {
        console.log(`\n[fix] Will DELETE these duplicate rows (correct form already exists):`);
        for (const d of toDelete) {
            const keep = existingByPhone.get(d.fixed)!;
            console.log(`  delete ${d.bad} "${d.companyName}"  (keeping ${keep.phoneNumber} "${keep.companyName}")`);
        }
    }

    console.log(`\n[fix] First 10 planned UPDATEs:`);
    for (const u of toUpdate.slice(0, 10)) {
        console.log(`  ${u.bad}  →  ${u.fixed}  (${u.companyName})`);
    }

    if (!APPLY) {
        console.log(`\n[fix] DRY RUN — no writes. Re-run with APPLY=1 to execute.`);
        return;
    }

    console.log(`\n[fix] APPLY=1 — executing…`);

    // 1. Delete duplicate broken rows (cascade is fine — these have attempts=0)
    if (toDelete.length > 0) {
        const ids = toDelete.map(d => d.id);
        // Cascade-relevant: Call.leadId is optional, Callback/Meeting/Activity require leadId.
        // For attempts=0/status=READY rows there should be no children, but null out Call.leadId defensively.
        await prisma.call.updateMany({ where: { leadId: { in: ids } }, data: { leadId: null } });
        const del = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
        console.log(`[fix] deleted ${del.count} duplicate rows`);
    }

    // 2. Batch update the rest
    const BATCH = 50;
    let done = 0;
    for (let i = 0; i < toUpdate.length; i += BATCH) {
        const slice = toUpdate.slice(i, i + BATCH);
        await prisma.$transaction(
            slice.map(u =>
                prisma.lead.update({
                    where: { id: u.id },
                    data: { phoneNumber: u.fixed, updatedAt: new Date() },
                })
            )
        );
        done += slice.length;
        process.stdout.write(`\r[fix]   updated ${done}/${toUpdate.length}`);
    }
    console.log(`\n[fix] Done.`);

    const remaining = await prisma.lead.count({
        where: { phoneNumber: { startsWith: "+1300" } },
    });
    const remaining1800 = await prisma.lead.count({
        where: { phoneNumber: { startsWith: "+1800" } },
    });
    console.log(`[fix] remaining +1300 leads: ${remaining}    remaining +1800 leads: ${remaining1800}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
