import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { leads: true } } }
        });
        return NextResponse.json(campaigns);
    } catch (error) {
        console.error("Failed to fetch campaigns", error);
        return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { name } = await req.json();
        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
        }
        const campaign = await prisma.campaign.create({
            data: { name: name.trim() },
            include: { _count: { select: { leads: true } } }
        });
        return NextResponse.json(campaign);
    } catch (error) {
        console.error("Failed to create campaign", error);
        return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
        }
        // Detach leads first
        await prisma.lead.updateMany({
            where: { campaignId: id },
            data: { campaignId: null }
        });
        await prisma.campaign.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete campaign", error);
        return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
    }
}
