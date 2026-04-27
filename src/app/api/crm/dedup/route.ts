import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeToE164 } from "@/lib/phone-utils";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const leads = await prisma.lead.findMany({
            select: { id: true, phoneNumber: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });

        const phoneMap = new Map();
        const duplicates = [];

        for (const lead of leads) {
            const clean = normalizeToE164(lead.phoneNumber);
            if (!clean) continue;

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
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const leadsAsc = await prisma.lead.findMany({
            select: { id: true, phoneNumber: true },
            orderBy: { createdAt: 'asc' }
        });

        const phoneMap = new Map();
        const idsToDelete: string[] = [];

        for (const lead of leadsAsc) {
            const clean = normalizeToE164(lead.phoneNumber);
            if (!clean) continue;

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
