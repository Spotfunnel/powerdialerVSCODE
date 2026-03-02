import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const [numbers, users, settings] = await Promise.all([
            prisma.numberPool.findMany({
                include: {
                    owner: { select: { id: true, name: true, email: true } }
                },
                orderBy: { phoneNumber: 'asc' }
            }),
            prisma.user.findMany({
                select: { id: true, name: true, email: true },
                orderBy: { name: 'asc' }
            }),
            prisma.settings.findUnique({ where: { id: "singleton" } })
        ]);

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const now = new Date();
        const hourlyLimit = settings?.hourlyNumberCap ?? 5;
        const dailyLimit = settings?.dailyNumberCap ?? 100;

        // Compute health data for each number
        const numbersWithHealth = await Promise.all(
            numbers.map(async (num) => {
                const hourlyCount = await prisma.call.count({
                    where: {
                        fromNumber: num.phoneNumber,
                        createdAt: { gte: oneHourAgo }
                    }
                });

                const isResting = num.cooldownUntil ? num.cooldownUntil > now : false;
                const cooldownRemaining = isResting && num.cooldownUntil
                    ? Math.ceil((num.cooldownUntil.getTime() - now.getTime()) / 60000)
                    : null;

                return {
                    ...num,
                    hourlyCount,
                    hourlyLimit,
                    dailyLimit,
                    cooldownRemaining,
                    isResting,
                };
            })
        );

        // Summary stats
        const activeCount = numbersWithHealth.filter(n => n.isActive && !n.isResting).length;
        const restingCount = numbersWithHealth.filter(n => n.isResting).length;
        const totalCount = numbersWithHealth.length;

        return NextResponse.json({
            numbers: numbersWithHealth,
            users,
            health: { activeCount, restingCount, totalCount, hourlyLimit, dailyLimit },
            rotationSettings: {
                hourlyNumberCap: settings?.hourlyNumberCap ?? 10,
                numberCooldownMin: settings?.numberCooldownMin ?? 120,
                dailyNumberCap: settings?.dailyNumberCap ?? 50,
                useGlobalPool: (settings as any)?.useGlobalPool ?? false
            }
        });
    } catch (error) {
        console.error("Failed to fetch numbers:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { id, ownerUserId, cooldownAction } = body;

        // Update rotation settings
        if (body.action === 'updateSettings') {
            const updates: any = {};
            if (body.hourlyNumberCap !== undefined) updates.hourlyNumberCap = parseInt(body.hourlyNumberCap);
            if (body.numberCooldownMin !== undefined) updates.numberCooldownMin = parseInt(body.numberCooldownMin);
            if (body.dailyNumberCap !== undefined) updates.dailyNumberCap = parseInt(body.dailyNumberCap);
            if (body.useGlobalPool !== undefined) updates.useGlobalPool = Boolean(body.useGlobalPool);

            await prisma.settings.update({ where: { id: "singleton" }, data: updates });
            return NextResponse.json({ success: true });
        }

        // Manual cooldown controls
        if (cooldownAction === 'force') {
            const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
            const cooldownMin = settings?.numberCooldownMin ?? 60;
            const updated = await prisma.numberPool.update({
                where: { id },
                data: { cooldownUntil: new Date(Date.now() + cooldownMin * 60 * 1000) }
            });
            return NextResponse.json({ success: true, number: updated });
        }

        if (cooldownAction === 'release') {
            const updated = await prisma.numberPool.update({
                where: { id },
                data: { cooldownUntil: null }
            });
            return NextResponse.json({ success: true, number: updated });
        }

        // Default: update owner assignment
        const updateData = { ownerUserId: ownerUserId || null };
        const updated = await prisma.numberPool.update({
            where: { id },
            data: updateData,
            include: { owner: { select: { name: true } } }
        });

        return NextResponse.json({ success: true, number: updated });
    } catch (error) {
        console.error("Failed to update number:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
