import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * Shared gate for /api/admin/** route handlers.
 *
 * The middleware matcher (src/middleware.ts) deliberately excludes /api/** so
 * that Twilio webhooks and cron endpoints (which authenticate by signature /
 * bearer, not session) work without a NextAuth token. The consequence is that
 * every admin API route must guard itself. This is that guard.
 *
 * Returns a 401 NextResponse to return early, or null when the caller is an
 * authenticated ADMIN and the handler may proceed.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
    const session = (await getServerSession(authOptions)) as any;
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
}
