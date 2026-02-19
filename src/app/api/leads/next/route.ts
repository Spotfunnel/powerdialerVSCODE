import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    try {
        // Atomic acquisition using PostgreSQL SKIP LOCKED
        // This prevents race conditions where two reps get the same lead.
        const leads = await prisma.$queryRaw<any[]>`
            UPDATE "Lead"
            SET 
                status = 'LOCKED', 
                "lockedById" = ${userId}, 
                "lockedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = (
                SELECT id 
                FROM "Lead" 
                WHERE 
                    (status = 'READY' OR (status = 'CALLBACK' AND "nextCallAt" <= NOW()))
                    AND "lockedById" IS NULL
                ORDER BY status DESC, "nextCallAt" ASC, attempts ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *;
        `;

        const lead = leads && leads.length > 0 ? leads[0] : null;

        if (!lead) {
            return NextResponse.json({ message: "No leads available" }, { status: 404 });
        }

        return NextResponse.json(lead);
    } catch (error) {
        console.error("Fetch next lead failed", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
