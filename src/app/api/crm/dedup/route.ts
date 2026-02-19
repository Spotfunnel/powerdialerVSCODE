import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const leads = await prisma.lead.findMany({
            select: { id: true, phoneNumber: true, createdAt: true },
            orderBy: { createdAt: 'desc' } // Keep newest? Or oldest? Usually keep newest if imported later.
        });

        const phoneMap = new Map();
        const duplicates = [];

        for (const lead of leads) {
            // Normalize: Remove all non-digits, replace leading 0 with +61
            // e.g. "0412 345 678" -> "412345678" -> "+61412345678"
            // e.g. "+61 412..." -> "61412..." -> "+61412..."
            let clean = lead.phoneNumber.replace(/\D/g, '');
            if (clean.startsWith('0')) clean = '61' + clean.substring(1);
            if (clean.startsWith('61')) clean = '+' + clean;

            // Fallback for non-standard
            if (!clean.startsWith('+')) clean = '+' + clean;

            if (phoneMap.has(clean)) {
                duplicates.push({
                    original: phoneMap.get(clean).id,
                    duplicate: lead.id,
                    phone: lead.phoneNumber,
                    norm: clean
                });
            } else {
                phoneMap.set(clean, lead);
            }
        }

        return NextResponse.json({
            total: leads.length,
            unique: phoneMap.size,
            duplicateCount: duplicates.length,
            sample: duplicates.slice(0, 5)
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST() {
    try {
        const leads = await prisma.lead.findMany({
            select: { id: true, phoneNumber: true, createdAt: true },
            orderBy: { createdAt: 'desc' } // Keep newest (last imported) or oldest?
            // If we keep newest: We might lose history?
            // If we keep oldest: We might keep stale data?
            // Let's Keep Oldest (First Created) as the "Master", assuming imports are adding duplicates.
            // Actually, usually user wants the "most recent import" to win if it updated fields.
            // But if it's just a duplicate, we just want ONE.
            // Let's sort by createdAt ASC -> First one is Master.
        });

        // RE-FETCH with ASC sort to keep oldest
        const leadsAsc = await prisma.lead.findMany({
            select: { id: true, phoneNumber: true },
            orderBy: { createdAt: 'asc' }
        });

        const phoneMap = new Map();
        const idsToDelete: string[] = [];

        for (const lead of leadsAsc) {
            let clean = lead.phoneNumber.replace(/\D/g, '');
            if (clean.startsWith('0')) clean = '61' + clean.substring(1);
            if (!clean.startsWith('61')) clean = '61' + clean; // Assume AU if ambiguous
            clean = '+' + clean;

            if (phoneMap.has(clean)) {
                idsToDelete.push(lead.id);
            } else {
                phoneMap.set(clean, lead.id);
            }
        }

        if (idsToDelete.length > 0) {
            await prisma.lead.deleteMany({
                where: { id: { in: idsToDelete } }
            });
        }

        return NextResponse.json({
            deleted: idsToDelete.length,
            kept: phoneMap.size
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
