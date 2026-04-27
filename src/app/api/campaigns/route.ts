import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        const { name, region } = await req.json();
        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
        }
        const campaign = await prisma.campaign.create({
            data: { name: name.trim(), ...(region && { region }) },
            include: { _count: { select: { leads: true } } }
        });
        return NextResponse.json(campaign);
    } catch (error) {
        console.error("Failed to create campaign", error);
        return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { id, name, region } = await req.json();
        if (!id) {
            return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
        }
        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
        }
        const campaign = await prisma.campaign.update({
            where: { id },
            data: { name: name.trim(), ...(region && { region }) },
            include: { _count: { select: { leads: true } } }
        });
        return NextResponse.json(campaign);
    } catch (error) {
        console.error("Failed to rename campaign", error);
        return NextResponse.json({ error: "Failed to rename campaign" }, { status: 500 });
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
