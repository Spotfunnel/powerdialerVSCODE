
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { startOfDay, startOfWeek, startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetMonthStr = searchParams.get("month"); // Format: YYYY-MM

    // Default to current date if no month specified
    const now = new Date();
    let targetDate = now;

    if (targetMonthStr) {
        targetDate = new Date(`${targetMonthStr}-01T00:00:00`);
    }

    try {
        // 1. Identify Target Users (Leo & Kye)
        // We filter mainly by name or Role. 
        // Logic: Find users where name contains 'Leo' or 'Kye' OR Role is ADMIN
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: 'Leo', mode: 'insensitive' } },
                    { name: { contains: 'Kye', mode: 'insensitive' } },
                    // Fallback to specific emails if names fail?
                    // { email: { contains: 'leo' } }
                ]
            },
            select: { id: true, name: true, email: true }
        });

        // 2. Define Time Ranges
        // Note: Server time might be UTC. We want rough approximation or exact based on offset.
        // Ideally, we respect User timezone, But for MVP we use Server/UTC simplified.

        // For "Daily" and "Weekly", we always reference "NOW" (Live stats)
        const dayStart = startOfDay(now);
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start

        // For "Monthly", we reference the Target Date (could be historical)
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        // 3. Aggregate Stats for each user
        const userData = await Promise.all(users.map(async (user) => {

            // Helper to get stats for a date range
            const getStats = async (start: Date, end: Date) => {
                const calls = await prisma.call.count({
                    where: {
                        userId: user.id,
                        createdAt: { gte: start, lte: end }
                    }
                });

                const booked = await prisma.call.count({
                    where: {
                        userId: user.id,
                        createdAt: { gte: start, lte: end },
                        outcome: 'BOOKED'
                    }
                });

                const sold = await prisma.call.count({
                    where: {
                        userId: user.id,
                        createdAt: { gte: start, lte: end },
                        outcome: 'SOLD'
                    }
                });

                return { calls, booked, sold };
            };

            // Run queries in parallel
            const [daily, weekly, monthly] = await Promise.all([
                getStats(dayStart, now),
                getStats(weekStart, now),
                getStats(monthStart, monthEnd)
            ]);

            return {
                id: user.id,
                name: user.name || user.email.split('@')[0],
                stats: {
                    daily,
                    weekly,
                    monthly
                }
            };
        }));

        // 4. Generate History Options (Last 6 months)
        const history = [];
        for (let i = 0; i < 6; i++) {
            const d = subMonths(now, i);
            history.push({
                label: format(d, 'MMMM yyyy'),
                value: format(d, 'yyyy-MM')
            });
        }

        return NextResponse.json({
            period: format(targetDate, 'MMMM yyyy'),
            users: userData,
            history
        });

    } catch (error: any) {
        console.error("KPI API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
