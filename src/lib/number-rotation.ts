import { prisma } from "./prisma";

export interface NumberSelectionOptions {
    userId?: string;
    targetNumber?: string;
    channel?: "CALL" | "SMS";
    excludeNumbers?: string[];
}

export interface NumberSelectionResult {
    phoneNumber: string;
    numberId: string;
    method: string; // "owner-match" | "area-code-match" | "round-robin" | "settings-fallback" | "emergency-fallback"
}

/**
 * Centralized outbound number selection with round-robin rotation and auto-cooldown.
 * All call/SMS flows should use this instead of inline pool queries.
 */
export async function selectOutboundNumber(
    options: NumberSelectionOptions = {}
): Promise<NumberSelectionResult | null> {
    const { userId, targetNumber, channel = "CALL", excludeNumbers = [] } = options;

    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const hourlyCapLimit = settings?.hourlyNumberCap ?? 10;
        const dailyCapLimit = settings?.dailyNumberCap ?? 50;
        const cooldownMinutes = settings?.numberCooldownMin ?? 120;
        const useGlobalPool = (settings as any)?.useGlobalPool ?? false;

        const now = new Date();

        // Base filter: active, not in cooldown, under daily cap
        const baseWhere = {
            isActive: true,
            dailyCount: { lt: dailyCapLimit },
            OR: [
                { cooldownUntil: null },
                { cooldownUntil: { lte: now } }
            ],
            ...(excludeNumbers.length > 0 && {
                phoneNumber: { notIn: excludeNumbers }
            })
        };

        // Extract area code from target number for local matching
        // AU E.164: +61AXXXXXXXX where A is the area digit (4=mobile, 2=NSW, 3=VIC, etc.)
        const targetAreaCode = targetNumber
            ? targetNumber.replace(/\D/g, "").substring(2, 3)
            : "";

        let selected: { id: string; phoneNumber: string } | null = null;
        let method = "";

        if (!useGlobalPool) {
            // Priority 1: User-owned number (least recently used)
            if (userId) {
                selected = await prisma.numberPool.findFirst({
                    where: { ...baseWhere, ownerUserId: userId },
                    orderBy: [{ lastUsedAt: "asc" }, { dailyCount: "asc" }],
                    select: { id: true, phoneNumber: true }
                });
                if (selected) method = "owner-match";
            }

            // Priority 2: Area code match from shared pool
            if (!selected && targetAreaCode) {
                const sharedPool = await prisma.numberPool.findMany({
                    where: { ...baseWhere, ownerUserId: null },
                    orderBy: [{ lastUsedAt: "asc" }, { dailyCount: "asc" }],
                    select: { id: true, phoneNumber: true }
                });

                const areaMatch = sharedPool.find(n =>
                    n.phoneNumber.replace(/\D/g, "").substring(2, 3) === targetAreaCode
                );
                if (areaMatch) {
                    selected = areaMatch;
                    method = "area-code-match";
                }
            }
        }

        // Priority 3 (or sole strategy when global pool is on): Round-robin all numbers
        if (!selected) {
            selected = await prisma.numberPool.findFirst({
                where: baseWhere,
                orderBy: [{ lastUsedAt: "asc" }, { dailyCount: "asc" }],
                select: { id: true, phoneNumber: true }
            });
            if (selected) method = useGlobalPool ? "global-round-robin" : "round-robin";
        }

        // Priority 4: Settings fallback (pool exhausted)
        if (!selected) {
            const fallbackNumber = settings?.twilioFromNumbers?.split(",")[0]?.trim();
            if (fallbackNumber) {
                // Log pool exhaustion
                prisma.auditLog.create({
                    data: {
                        eventType: "NUMBER_POOL_EXHAUSTED",
                        payload: JSON.stringify({ channel, userId, targetNumber, timestamp: now.toISOString() })
                    }
                }).catch(e => console.error("[Rotation] Audit log fail:", e));

                console.warn(`[Rotation] Pool exhausted — falling back to settings number: ${fallbackNumber}`);
                return { phoneNumber: fallbackNumber, numberId: "", method: "emergency-fallback" };
            }
            return null;
        }

        // Update usage counters
        await prisma.numberPool.update({
            where: { id: selected.id },
            data: { lastUsedAt: now, dailyCount: { increment: 1 } }
        });

        // Check hourly usage and trigger cooldown if needed (fire-and-forget)
        triggerCooldownIfNeeded(selected.id, selected.phoneNumber, hourlyCapLimit, cooldownMinutes)
            .catch(e => console.error("[Rotation] Cooldown check fail:", e));

        console.log(`[Rotation] ${method}: ${selected.phoneNumber} | channel=${channel} | target=${targetNumber || "N/A"}`);

        return {
            phoneNumber: selected.phoneNumber,
            numberId: selected.id,
            method
        };

    } catch (error) {
        console.error("[Rotation] Selection failed:", error);
        return null;
    }
}

/**
 * Checks if a number has exceeded its hourly call limit and puts it in cooldown.
 * Uses NumberPool.dailyCount as primary signal since Call.fromNumber data is unreliable.
 */
async function triggerCooldownIfNeeded(
    numberId: string,
    phoneNumber: string,
    hourlyCapLimit: number,
    cooldownMinutes: number
) {
    // Read the pool record to get reliable dailyCount and lastUsedAt
    const poolRecord = await prisma.numberPool.findUnique({
        where: { id: numberId },
        select: { dailyCount: true, lastUsedAt: true }
    });

    if (!poolRecord) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Method 1: Call table count (works when fromNumber is correct)
    const callTableCount = await prisma.call.count({
        where: {
            fromNumber: phoneNumber,
            createdAt: { gte: oneHourAgo }
        }
    });

    // Method 2: If pool was recently active, use dailyCount as hourly estimate
    // This catches cases where Call records have wrong fromNumber values
    const poolActiveInLastHour = poolRecord.lastUsedAt && poolRecord.lastUsedAt >= oneHourAgo;
    const estimatedHourlyCount = poolActiveInLastHour
        ? Math.max(callTableCount, poolRecord.dailyCount)
        : callTableCount;

    if (estimatedHourlyCount >= hourlyCapLimit) {
        const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);
        await prisma.numberPool.update({
            where: { id: numberId },
            data: { cooldownUntil }
        });
        console.log(`[Rotation] ${phoneNumber} entered cooldown until ${cooldownUntil.toISOString()} (estimated ${estimatedHourlyCount} calls, callTable=${callTableCount}, poolDaily=${poolRecord.dailyCount})`);
    }

    // Also check number health (response rate monitoring) — fire-and-forget
    checkNumberHealth(numberId, phoneNumber, cooldownMinutes)
        .catch(e => console.error("[Health] Check failed:", e));
}

/**
 * Checks a number's health based on recent call outcomes.
 * Red flags: high busy rate, low answer rate, short durations, carrier errors.
 * Triggers extended cooldown (4h) when thresholds are breached.
 * Minimum 5 calls required to evaluate (avoids false positives).
 */
async function checkNumberHealth(
    numberId: string,
    phoneNumber: string,
    cooldownMinutes: number
): Promise<void> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const recentCalls = await prisma.call.findMany({
        where: {
            fromNumber: phoneNumber,
            createdAt: { gte: twoHoursAgo }
        },
        select: { status: true, outcome: true, duration: true }
    });

    const totalCalls = recentCalls.length;
    if (totalCalls < 10) return;

    const busyCount = recentCalls.filter(c =>
        c.status === "busy" || c.outcome === "BUSY"
    ).length;

    const answeredCalls = recentCalls.filter(c =>
        c.status === "completed" || c.status === "answered" || c.status === "in-progress"
    );
    const answeredCount = answeredCalls.length;

    const failedCount = recentCalls.filter(c => c.status === "failed").length;

    const busyRate = busyCount / totalCalls;
    const answerRate = answeredCount / totalCalls;
    const failRate = failedCount / totalCalls;

    const avgDuration = answeredCount > 0
        ? answeredCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / answeredCount
        : 0;

    const redFlags: string[] = [];
    if (busyRate > 0.4) redFlags.push(`busy_rate=${(busyRate * 100).toFixed(0)}%`);
    if (answerRate < 0.15) redFlags.push(`answer_rate=${(answerRate * 100).toFixed(0)}%`);
    if (answeredCount >= 3 && avgDuration < 15) redFlags.push(`avg_duration=${avgDuration.toFixed(0)}s`);
    if (failRate > 0.3) redFlags.push(`fail_rate=${(failRate * 100).toFixed(0)}%`);

    if (redFlags.length === 0) return;

    // Extended cooldown: 4 hours or 2x normal, whichever is greater
    const extendedCooldownMs = Math.max(4 * 60 * 60 * 1000, cooldownMinutes * 2 * 60 * 1000);
    const cooldownUntil = new Date(Date.now() + extendedCooldownMs);

    // Don't shorten an existing longer cooldown
    const current = await prisma.numberPool.findUnique({
        where: { id: numberId },
        select: { cooldownUntil: true }
    });
    if (current?.cooldownUntil && current.cooldownUntil > cooldownUntil) return;

    await prisma.numberPool.update({
        where: { id: numberId },
        data: { cooldownUntil }
    });

    prisma.auditLog.create({
        data: {
            eventType: "NUMBER_HEALTH_COOLDOWN",
            payload: JSON.stringify({
                phoneNumber, numberId, totalCalls,
                busyRate: (busyRate * 100).toFixed(1),
                answerRate: (answerRate * 100).toFixed(1),
                avgDuration: avgDuration.toFixed(1),
                failRate: (failRate * 100).toFixed(1),
                redFlags,
                cooldownUntil: cooldownUntil.toISOString(),
            })
        }
    }).catch(e => console.error("[Health] Audit log fail:", e));

    console.log(`[Health] ${phoneNumber} entered extended cooldown until ${cooldownUntil.toISOString()} | flags: ${redFlags.join(", ")} | calls=${totalCalls}`);
}
