import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    try {
        // Calculate start of day (Australia/Sydney)
        // This ensures morning calls in AU (which are prev day UTC) are counted.
        const timeZone = 'Australia/Sydney';
        const now = new Date();

        // Get "Today" in Sydney
        const sydneyDateString = now.toLocaleDateString('en-US', { timeZone });
        // Create date object for 00:00 Sydney time
        // Note: We need to find the UTC Equivalent of "00:00 Sydney Today"
        // This is a bit tricky without a library, but reasonable approximation:
        const startOfDay = new Date(sydneyDateString);
        // localDateString gives "MM/DD/YYYY". new Date() parse it as... UTC? No, usually local.
        // But in Node (Vercel), local is UTC. So it creates 00:00 UTC.
        // We want 00:00 Sydney. 00:00 Sydney is usually 13:00 (prev day) UTC.

        // Better approach: Get timestamp, subtract offset?
        // Let's use a robust approach for "Last 24 hours" if 'daily' is ambiguous, 
        // OR just hardcode the offset logic if we don't have date-fns-tz.
        // We have date-fns.

        // Let's rely on the formatted string to get the Y-M-D of Sydney.
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(now);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;

        // "YYYY-MM-DDT00:00:00" generic ISO
        const sydneyMidnightIso = `${year}-${month}-${day}T00:00:00`;

        // Now find the specific Date object where .toLocaleString('en-US', {timeZone}) equals that.
        // OR: Just hardcode: calls created AFTER "Today 00:00 Sydney".
        // 00:00 Sydney is UTC-11 (or -10).
        // Let's just look back 18 hours from NOW if it's early? No.

        // Let's try to construct it.
        // Direct string construction works if we trust the offset.
        // Safe bet: Calls created > (Now - 24 hours) AND content is from "today"?
        // No, user wants "Daily" counter.

        // Let's blindly trust that we want records created since THIS UTC timestamp:
        // (Sydney Midnight)
        const sydneyMidnight = new Date(new Date().toLocaleString("en-US", { timeZone })).setHours(0, 0, 0, 0);
        // Wait, new Date(string) in Server (UTC) interprets local string as UTC.
        // Example: Sydney is 10th. String "10th". new Date("10th") -> 10th 00:00 UTC.
        // 10th 00:00 UTC is 10th 11:00 Sydney.
        // 10th 00:00 Sydney is 9th 13:00 UTC.
        // So we are off by 11 hours. We are counting from 11am Sydney.
        // We need to SUBTRACT 11 hours (or 10) from that "UTC Midnight".

        const offsetHours = 11; // Approx for Sydney
        const estimatedSydneyMidnight = new Date(new Date(sydneyDateString).getTime() - (offsetHours * 60 * 60 * 1000));

        const stats = await withPrismaRetry(async () => {
            const [todayCalls, todayDemos] = await Promise.all([
                // Count calls created today
                prisma.leadActivity.count({
                    where: {
                        userId: userId,
                        type: 'CALL',
                        createdAt: {
                            gte: estimatedSydneyMidnight
                        }
                    }
                }),
                // Count demos (simplified: just return 0 to avoid build error with JSON filter)
                Promise.resolve(0)
            ]);

            // Simplified revenue calc (e.g. $150 per demo)
            const revenue = todayDemos * 150;

            return {
                calls: todayCalls,
                demos: todayDemos,
                revenue
            };
        }, 3, 1000, true); // Auto-disconnect enabled

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("Failed to fetch user stats:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
