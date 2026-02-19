
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: 'Leo' } },
                    { name: { contains: 'Kye' } },
                    { role: 'ADMIN' }
                ]
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        });

        return NextResponse.json(users);
    } catch (error: any) {
        console.error("Failed to fetch specialists:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
