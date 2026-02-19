import { NextResponse } from "next/server";
import { verifyTwilio } from "@/lib/integrations";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { sid, token } = await req.json();
        const result = await verifyTwilio(sid, token);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ success: false, error: "Verification failed" });
    }
}
