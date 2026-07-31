/**
 * Seeds a few clearly-labelled TEST leads so the dialer queue is non-empty.
 * The fresh DB has zero leads, which surfaces as "QUEUE UNREACHABLE / empty".
 *
 * Numbers are deliberately non-routable placeholders (+61400000xxx) so an
 * accidental click-to-call fails fast instead of dialing a stranger. Replace
 * with a real import (or set TEST_LEAD_PHONE to your own mobile for a live
 * end-to-end call). Idempotent on phoneNumber (unique).
 */
import 'dotenv/config';
import { prisma } from "../src/lib/prisma";

async function main() {
    const realPhone = process.env.TEST_LEAD_PHONE; // optional: your mobile, E.164
    const rows = realPhone
        ? [{ companyName: "TEST — live audio call (delete me)", firstName: "Test", phoneNumber: realPhone, state: "NSW" }]
        : [
            { companyName: "TEST LEAD 1 (delete me)", firstName: "Alpha", phoneNumber: "+61400000001", state: "NSW" },
            { companyName: "TEST LEAD 2 (delete me)", firstName: "Bravo", phoneNumber: "+61400000002", state: "VIC" },
            { companyName: "TEST LEAD 3 (delete me)", firstName: "Charlie", phoneNumber: "+61400000003", state: "QLD" },
        ];

    for (const r of rows) {
        await prisma.lead.upsert({
            where: { phoneNumber: r.phoneNumber },
            update: { status: "READY", lockedById: null, lockedAt: null },
            create: { ...r, status: "READY", source: "TEST", priority: "A" },
        });
    }

    const total = await prisma.lead.count();
    const ready = await prisma.lead.count({ where: { status: "READY", lockedById: null } });
    console.log(`Seeded. TOTAL leads=${total}  READY+unlocked=${ready}`);

    // Prove the acquisition query would return one WITHOUT locking it, by
    // reading the exact predicate getNextLead uses.
    const acquirable = await prisma.lead.findFirst({
        where: {
            OR: [
                { status: "READY" },
                { status: "CALLBACK", nextCallAt: { lte: new Date() } },
            ],
            lockedById: null,
        },
        orderBy: [{ priority: "asc" }, { updatedAt: "asc" }],
        select: { id: true, companyName: true, phoneNumber: true, status: true },
    });
    console.log("Next acquirable lead:", acquirable
        ? `${acquirable.companyName} ${acquirable.phoneNumber} [${acquirable.status}]`
        : "NONE — queue would still be empty");
}

main().catch(e => { console.error("FAILED:", e?.message ?? e); process.exit(1); })
    .finally(() => prisma.$disconnect());
