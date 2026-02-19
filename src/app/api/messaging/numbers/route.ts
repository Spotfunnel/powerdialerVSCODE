import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const userId = (session.user as any).id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        let numbers;
        if (user?.role === 'ADMIN') {
            // Admins can see all active numbers
            numbers = await prisma.numberPool.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    phoneNumber: true,
                    ownerUserId: true
                }
            });
        } else {
            // Regular users see their owned numbers plus unassigned/shared numbers
            numbers = await prisma.numberPool.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { ownerUserId: userId },
                        { ownerUserId: null }
                    ]
                },
                select: {
                    id: true,
                    phoneNumber: true,
                    ownerUserId: true
                }
            });
        }

        return NextResponse.json(numbers);
    } catch (error) {
        console.error("Failed to fetch numbers", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
