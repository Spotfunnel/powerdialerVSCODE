import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const numbers = await prisma.numberPool.findMany({
            include: {
                owner: { select: { id: true, name: true, email: true } }
            },
            orderBy: { phoneNumber: 'asc' }
        });

        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({ numbers, users });
    } catch (error) {
        console.error("Failed to fetch numbers:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id, ownerUserId } = await req.json();

        // Allow unassigning by passing null
        const updateData = { ownerUserId: ownerUserId || null };

        const updated = await prisma.numberPool.update({
            where: { id },
            data: updateData,
            include: { owner: { select: { name: true } } }
        });

        return NextResponse.json({ success: true, number: updated });
    } catch (error) {
        console.error("Failed to update number owner:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
