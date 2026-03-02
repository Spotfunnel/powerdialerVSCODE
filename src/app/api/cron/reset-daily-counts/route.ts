import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    // Verify cron secret (Vercel Cron or manual trigger)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Reset daily counts
        const resetResult = await prisma.numberPool.updateMany({
            data: { dailyCount: 0 }
        });

        // Clear expired cooldowns
        const cooldownResult = await prisma.numberPool.updateMany({
            where: { cooldownUntil: { lte: new Date() } },
            data: { cooldownUntil: null }
        });

        console.log(`[Cron] Daily reset: ${resetResult.count} numbers reset, ${cooldownResult.count} cooldowns cleared`);

        return NextResponse.json({
            success: true,
            resetAt: new Date().toISOString(),
            numbersReset: resetResult.count,
            cooldownsCleared: cooldownResult.count
        });
    } catch (error) {
        console.error("[Cron] Daily reset failed:", error);
        return NextResponse.json({ error: "Reset failed" }, { status: 500 });
    }
}
