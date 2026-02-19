
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
        const callbacks = await prisma.callback.findMany({
            where: {
                status: 'PENDING'
            },
            include: {
                lead: true
            },
            orderBy: {
                callbackAt: 'asc'
            }
        });

        return NextResponse.json(callbacks);
    } catch (error: any) {
        console.error("Callbacks API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        await prisma.callback.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete callback:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id, status } = await req.json();

        if (!id || !status) {
            return NextResponse.json({ error: "Missing ID or status" }, { status: 400 });
        }

        const callback = await prisma.callback.update({
            where: { id },
            data: { status }
        });

        return NextResponse.json(callback);
    } catch (error: any) {
        console.error("Failed to update callback:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
