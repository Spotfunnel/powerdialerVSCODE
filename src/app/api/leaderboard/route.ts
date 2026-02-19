
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
        // Aggregate real data from the Call table
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
            }
        });

        const leaderboard = await Promise.all(users.map(async (user, index) => {
            const callCount = await prisma.call.count({
                where: { userId: user.id }
            });

            const bookings = await prisma.call.count({
                where: {
                    userId: user.id,
                    outcome: 'BOOKED'
                }
            });

            const sales = await prisma.call.count({
                where: {
                    userId: user.id,
                    outcome: 'SOLD'
                }
            });

            return {
                name: user.name || user.email.split('@')[0],
                calls: callCount,
                bookings: bookings,
                sales: sales,
                rank: index + 1 // Temporary rank, will sort below
            };
        }));

        // Sort by bookings then calls
        leaderboard.sort((a, b) => (b.bookings - a.bookings) || (b.calls - a.calls));

        // Finalize rank
        const rankedLeaderboard = leaderboard.map((item, idx) => ({
            ...item,
            rank: idx + 1
        }));

        return NextResponse.json(rankedLeaderboard);
    } catch (error: any) {
        console.error("Leaderboard API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
