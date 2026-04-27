/**
 * Characterization tests for src/lib/number-rotation.ts
 *
 * Pins down the behaviour of the wip-checkpoint changes:
 *   1. Atomic cooldown check (cap enforced inside $transaction with the increment)
 *   2. Region filtering via baseWhere.regionTag
 *   3. Settings cache (60s TTL — one prisma call within window, fresh fetch after)
 *   4. Fallback cooldown (when emergency-fallback number is also on cooldown, return null)
 *   5. Health-check threshold (skip when totalCalls < 5)
 *
 * Production source is mocked at the @/lib/prisma boundary — no DB required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Prisma mocks ----------------------------------------------------------

type AnyFn = (...args: any[]) => any;

const mockSettingsFindUnique = vi.fn();
const mockPoolFindFirst = vi.fn();
const mockPoolFindMany = vi.fn();
const mockPoolFindUnique = vi.fn();
const mockPoolUpdate = vi.fn();
const mockCallCount = vi.fn();
const mockCallFindMany = vi.fn();
const mockAuditCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => {
    const tx = {
        numberPool: {
            update: (...args: any[]) => mockPoolUpdate(...args),
        },
        call: {
            count: (...args: any[]) => mockCallCount(...args),
        },
    };
    return {
        prisma: {
            settings: {
                findUnique: (...args: any[]) => mockSettingsFindUnique(...args),
            },
            numberPool: {
                findFirst: (...args: any[]) => mockPoolFindFirst(...args),
                findMany: (...args: any[]) => mockPoolFindMany(...args),
                findUnique: (...args: any[]) => mockPoolFindUnique(...args),
                update: (...args: any[]) => mockPoolUpdate(...args),
            },
            call: {
                count: (...args: any[]) => mockCallCount(...args),
                findMany: (...args: any[]) => mockCallFindMany(...args),
            },
            auditLog: {
                create: (...args: any[]) => mockAuditCreate(...args),
            },
            $transaction: (cb: AnyFn) => mockTransaction(cb, tx),
        },
    };
});

// Default $transaction behaviour: actually run the callback against the tx stub.
function defaultTransactionImpl(cb: AnyFn, tx: any) {
    return cb(tx);
}

// ---- Helpers ---------------------------------------------------------------

const POOL_ROW = (over: Partial<any> = {}) => ({
    id: "np-1",
    phoneNumber: "+61412000001",
    dailyCount: 1,
    lastUsedAt: new Date(),
    cooldownUntil: null,
    ...over,
});

function resetAllMocks() {
    mockSettingsFindUnique.mockReset();
    mockPoolFindFirst.mockReset();
    mockPoolFindMany.mockReset();
    mockPoolFindUnique.mockReset();
    mockPoolUpdate.mockReset();
    mockCallCount.mockReset();
    mockCallFindMany.mockReset();
    mockAuditCreate.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockImplementation(defaultTransactionImpl);

    // Sane defaults
    mockAuditCreate.mockResolvedValue(undefined);
    mockCallFindMany.mockResolvedValue([]); // no health-check trips
    mockCallCount.mockResolvedValue(0);
    mockPoolUpdate.mockImplementation(({ data }: any) =>
        Promise.resolve(POOL_ROW({ ...data, dailyCount: 2, lastUsedAt: new Date() }))
    );
}

/**
 * Reset the in-module settings cache between tests by re-importing the module.
 * We use vi.resetModules() so that the closure-scoped `_settingsCache` is fresh.
 */
async function freshImport() {
    vi.resetModules();
    return await import("@/lib/number-rotation");
}

beforeEach(() => {
    resetAllMocks();
    vi.useRealTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

// ===========================================================================
// 1. Atomic cooldown inside $transaction
// ===========================================================================
describe("selectOutboundNumber — atomic cooldown in $transaction", () => {
    it("runs increment and cooldown check inside a single $transaction call", async () => {
        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 10,
            dailyNumberCap: 50,
            numberCooldownMin: 120,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });
        mockPoolFindFirst.mockResolvedValue({ id: "np-1", phoneNumber: "+61412000001" });
        mockCallCount.mockResolvedValue(2); // well under cap

        const { selectOutboundNumber } = await freshImport();

        const result = await selectOutboundNumber({ userId: "u1" });

        expect(result).not.toBeNull();
        expect(result!.phoneNumber).toBe("+61412000001");
        expect(mockTransaction).toHaveBeenCalledTimes(1);

        // Within the transaction: update first, then count
        expect(mockPoolUpdate).toHaveBeenCalled();
        expect(mockCallCount).toHaveBeenCalled();
        // Cooldown branch NOT taken (only one update call: the increment)
        expect(mockPoolUpdate).toHaveBeenCalledTimes(1);
        expect(mockPoolUpdate.mock.calls[0][0]).toMatchObject({
            where: { id: "np-1" },
            data: expect.objectContaining({ dailyCount: { increment: 1 } }),
        });
    });

    it("triggers cooldown inside the transaction when hourly cap is breached", async () => {
        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 5,
            dailyNumberCap: 50,
            numberCooldownMin: 60,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });
        mockPoolFindFirst.mockResolvedValue({ id: "np-1", phoneNumber: "+61412000001" });
        // After increment, dailyCount becomes 6 — at/over cap
        mockPoolUpdate.mockImplementationOnce(() =>
            Promise.resolve(POOL_ROW({ dailyCount: 6, lastUsedAt: new Date() }))
        );
        mockCallCount.mockResolvedValue(2);

        const { selectOutboundNumber } = await freshImport();
        const result = await selectOutboundNumber({ userId: "u1" });

        expect(result).not.toBeNull();
        // Two pool.update calls inside the transaction: one increment, one cooldown
        expect(mockPoolUpdate).toHaveBeenCalledTimes(2);
        const cooldownCall = mockPoolUpdate.mock.calls[1][0];
        expect(cooldownCall).toMatchObject({ where: { id: "np-1" } });
        expect(cooldownCall.data.cooldownUntil).toBeInstanceOf(Date);
    });

    it("respects the cap across two near-concurrent calls", async () => {
        // Cap = 2. Two rapid invocations should each enter the transaction; the
        // second invocation observes a higher dailyCount and trips cooldown.
        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 2,
            dailyNumberCap: 50,
            numberCooldownMin: 60,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });
        mockPoolFindFirst.mockResolvedValue({ id: "np-1", phoneNumber: "+61412000001" });

        // First update returns dailyCount=2 (just hit cap), second returns 3
        let updateCount = 0;
        mockPoolUpdate.mockImplementation(({ data }: any) => {
            // Cooldown writes have data.cooldownUntil; ignore for counter logic
            if (data && data.cooldownUntil) return Promise.resolve(POOL_ROW());
            updateCount++;
            return Promise.resolve(
                POOL_ROW({ dailyCount: 1 + updateCount, lastUsedAt: new Date() })
            );
        });
        mockCallCount.mockResolvedValue(0);

        const { selectOutboundNumber } = await freshImport();
        const [a, b] = await Promise.all([
            selectOutboundNumber({ userId: "u1" }),
            selectOutboundNumber({ userId: "u1" }),
        ]);

        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        // Both took the transaction path
        expect(mockTransaction).toHaveBeenCalledTimes(2);
        // At least one cooldown write happened (a write with cooldownUntil)
        const cooldownWrites = mockPoolUpdate.mock.calls.filter(
            (c: any[]) => c[0]?.data?.cooldownUntil
        );
        expect(cooldownWrites.length).toBeGreaterThanOrEqual(1);
    });
});

// ===========================================================================
// 2. Region filtering — regionTag passed into baseWhere
// ===========================================================================
describe("selectOutboundNumber — region filtering", () => {
    beforeEach(() => {
        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 10,
            dailyNumberCap: 50,
            numberCooldownMin: 120,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });
    });

    it("includes regionTag='US' in the query when region='US'", async () => {
        mockPoolFindFirst.mockResolvedValue({ id: "us-1", phoneNumber: "+15551234567" });
        const { selectOutboundNumber } = await freshImport();

        const res = await selectOutboundNumber({ userId: "u1", region: "US" });

        expect(res).not.toBeNull();
        // Every pool.findFirst call's where-clause must carry the regionTag filter
        for (const [args] of mockPoolFindFirst.mock.calls) {
            expect(args.where).toMatchObject({ regionTag: "US" });
        }
    });

    it("includes regionTag='AU' in the query when region='AU'", async () => {
        mockPoolFindFirst.mockResolvedValue({ id: "au-1", phoneNumber: "+61412000001" });
        const { selectOutboundNumber } = await freshImport();

        const res = await selectOutboundNumber({ userId: "u1", region: "AU" });

        expect(res).not.toBeNull();
        for (const [args] of mockPoolFindFirst.mock.calls) {
            expect(args.where).toMatchObject({ regionTag: "AU" });
        }
    });

    it("omits regionTag from the query when region is undefined", async () => {
        mockPoolFindFirst.mockResolvedValue({ id: "any-1", phoneNumber: "+61412000001" });
        const { selectOutboundNumber } = await freshImport();

        await selectOutboundNumber({ userId: "u1" });

        for (const [args] of mockPoolFindFirst.mock.calls) {
            expect(args.where).not.toHaveProperty("regionTag");
        }
    });

    it("returns null and skips the AU emergency fallback when region='US' and pool is empty", async () => {
        mockPoolFindFirst.mockResolvedValue(null);
        const { selectOutboundNumber } = await freshImport();

        const res = await selectOutboundNumber({ userId: "u1", region: "US" });

        expect(res).toBeNull();
        // Specifically: never queries the fallback by phoneNumber
        const calledForFallback = mockPoolFindFirst.mock.calls.some(
            (c: any[]) => c[0]?.where?.phoneNumber === "+61400000000"
        );
        expect(calledForFallback).toBe(false);
    });
});

// ===========================================================================
// 3. Settings cache (60s TTL)
// ===========================================================================
describe("getCachedSettings — 60s TTL", () => {
    it("hits prisma once for two calls within 60s, twice when the window expires", async () => {
        vi.useFakeTimers();
        const baseTime = new Date("2026-04-27T12:00:00Z").getTime();
        vi.setSystemTime(baseTime);

        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 10,
            dailyNumberCap: 50,
            numberCooldownMin: 120,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });
        mockPoolFindFirst.mockResolvedValue({ id: "np-1", phoneNumber: "+61412000001" });

        const { selectOutboundNumber } = await freshImport();

        // Call 1: cold cache → 1 prisma settings read
        await selectOutboundNumber({ userId: "u1" });
        expect(mockSettingsFindUnique).toHaveBeenCalledTimes(1);

        // Advance 30s — still within TTL
        vi.setSystemTime(baseTime + 30_000);
        await selectOutboundNumber({ userId: "u1" });
        expect(mockSettingsFindUnique).toHaveBeenCalledTimes(1);

        // Advance past 60s — cache expired
        vi.setSystemTime(baseTime + 61_000);
        await selectOutboundNumber({ userId: "u1" });
        expect(mockSettingsFindUnique).toHaveBeenCalledTimes(2);
    });
});

// ===========================================================================
// 4. Fallback cooldown — pool exhausted AND fallback in cooldown → null
// ===========================================================================
describe("selectOutboundNumber — emergency fallback cooldown", () => {
    it("returns null when pool is empty and the settings fallback is on cooldown", async () => {
        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 10,
            dailyNumberCap: 50,
            numberCooldownMin: 120,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });

        const futureCooldown = new Date(Date.now() + 60 * 60 * 1000);
        // First findFirst -> pool selection (empty); second findFirst -> fallback lookup (on cooldown)
        mockPoolFindFirst
            .mockResolvedValueOnce(null) // owner-match attempt
            .mockResolvedValueOnce(null) // round-robin attempt
            .mockResolvedValueOnce({ cooldownUntil: futureCooldown }); // fallback lookup

        const { selectOutboundNumber } = await freshImport();
        const res = await selectOutboundNumber({ userId: "u1" });

        expect(res).toBeNull();
        // The audit log for "all pool exhausted" should be fired
        expect(mockAuditCreate).toHaveBeenCalled();
        const eventTypes = mockAuditCreate.mock.calls.map((c: any[]) => c[0]?.data?.eventType);
        expect(eventTypes).toContain("NUMBER_POOL_EXHAUSTED_ALL");
    });

    it("returns the emergency-fallback number when pool is empty and fallback is NOT on cooldown", async () => {
        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 10,
            dailyNumberCap: 50,
            numberCooldownMin: 120,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });

        mockPoolFindFirst
            .mockResolvedValueOnce(null) // owner-match attempt
            .mockResolvedValueOnce(null) // round-robin attempt
            .mockResolvedValueOnce({ cooldownUntil: null }); // fallback lookup — clear

        const { selectOutboundNumber } = await freshImport();
        const res = await selectOutboundNumber({ userId: "u1" });

        expect(res).not.toBeNull();
        expect(res!.method).toBe("emergency-fallback");
        expect(res!.phoneNumber).toBe("+61400000000");
    });
});

// ===========================================================================
// 5. Health-check threshold (boundary at 5 calls, lowered from 10)
// ===========================================================================
describe("checkNumberHealth — minimum-calls threshold (5)", () => {
    function makeCalls(n: number, status = "busy") {
        return Array.from({ length: n }, () => ({
            status,
            outcome: status === "busy" ? "BUSY" : null,
            duration: 0,
        }));
    }

    /**
     * Health-check is fire-and-forget after a successful selection.
     * We assert the threshold by observing whether a health-driven cooldown write
     * happens (via an audit log entry of type NUMBER_HEALTH_COOLDOWN).
     */
    async function runOnceWithRecentCalls(recentCallCount: number) {
        mockSettingsFindUnique.mockResolvedValue({
            hourlyNumberCap: 100,
            dailyNumberCap: 500,
            numberCooldownMin: 60,
            useGlobalPool: false,
            twilioFromNumbers: "+61400000000",
        });
        mockPoolFindFirst.mockResolvedValue({ id: "np-1", phoneNumber: "+61412000001" });
        mockPoolFindUnique.mockResolvedValue({ cooldownUntil: null });

        // Health check reads recent calls — drive it with the requested count of bad calls
        // (>40% busy rate, which is one of the redFlag triggers).
        mockCallFindMany.mockResolvedValue(makeCalls(recentCallCount, "busy"));

        const { selectOutboundNumber } = await freshImport();
        await selectOutboundNumber({ userId: "u1" });

        // Health check is fire-and-forget: flush microtasks so promises settle.
        await new Promise((r) => setImmediate(r));
    }

    it("does NOT trigger a health cooldown when totalCalls < 5", async () => {
        await runOnceWithRecentCalls(4);

        const healthEvents = mockAuditCreate.mock.calls.filter(
            (c: any[]) => c[0]?.data?.eventType === "NUMBER_HEALTH_COOLDOWN"
        );
        expect(healthEvents.length).toBe(0);
    });

    it("DOES evaluate health (and trigger cooldown for unhealthy patterns) at totalCalls === 5", async () => {
        await runOnceWithRecentCalls(5);

        const healthEvents = mockAuditCreate.mock.calls.filter(
            (c: any[]) => c[0]?.data?.eventType === "NUMBER_HEALTH_COOLDOWN"
        );
        expect(healthEvents.length).toBe(1);
    });
});
