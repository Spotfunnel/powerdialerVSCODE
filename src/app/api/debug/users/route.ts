import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, role: true, repPhoneNumber: true, name: true }
        });
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const pool = await prisma.numberPool.findMany();

        return NextResponse.json({ users, settings, pool });
    } catch (error) {
        return NextResponse.json({ error: (error as any).message }, { status: 500 });
    }
}
