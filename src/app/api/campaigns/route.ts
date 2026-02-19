import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(campaigns);
    } catch (error) {
        console.error("Failed to fetch campaigns", error);
        return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
    }
}
