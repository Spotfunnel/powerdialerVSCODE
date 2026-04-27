import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for /api/cron/reset-daily-counts GET handler.
 *
 * The route is intended to be called by Vercel Cron (or a manual trigger) and
 * resets dailyCount + clears expired cooldowns on every NumberPool row.
 *
 * Bug being driven out: when CRON_SECRET is unset, the auth guard
 *   `if (cronSecret && authHeader !== ...)`
 * is short-circuited entirely, leaving the route fully public. This file pins
 * the four auth states:
 *   1. CRON_SECRET unset, no header                  → 401  (currently 200 — the bug)
 *   2. CRON_SECRET set,   no header                  → 401
 *   3. CRON_SECRET set,   wrong "Bearer ..." header  → 401
 *   4. CRON_SECRET set,   correct header             → 200 + DB writes happen
 */

// ---- Mocks ---------------------------------------------------------------
const { mockUpdateMany } = vi.hoisted(() => ({
    mockUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        numberPool: { updateMany: mockUpdateMany },
    },
}));

// ---- Imports under test --------------------------------------------------
import { GET } from "@/app/api/cron/reset-daily-counts/route";

// ---- Helpers -------------------------------------------------------------
function fakeRequest(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/cron/reset-daily-counts", {
        headers,
    });
}

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
    if (ORIGINAL_CRON_SECRET === undefined) {
        delete process.env.CRON_SECRET;
    } else {
        process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
    }
});

// ---- Tests ---------------------------------------------------------------
describe("GET /api/cron/reset-daily-counts — auth", () => {
    it("returns 401 when CRON_SECRET is unset and no Authorization header is provided", async () => {
        delete process.env.CRON_SECRET;

        const res = await GET(fakeRequest());

        expect(res.status).toBe(401);
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("returns 401 when CRON_SECRET is set but no Authorization header is provided", async () => {
        process.env.CRON_SECRET = "test-secret-abc";

        const res = await GET(fakeRequest());

        expect(res.status).toBe(401);
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("returns 401 when CRON_SECRET is set but the Authorization header is wrong", async () => {
        process.env.CRON_SECRET = "test-secret-abc";

        const res = await GET(
            fakeRequest({ authorization: "Bearer wrong-secret" }),
        );

        expect(res.status).toBe(401);
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("returns 200 and runs the reset when CRON_SECRET matches the Authorization header", async () => {
        process.env.CRON_SECRET = "test-secret-abc";
        mockUpdateMany
            .mockResolvedValueOnce({ count: 7 }) // dailyCount reset
            .mockResolvedValueOnce({ count: 3 }); // cooldown clear

        const res = await GET(
            fakeRequest({ authorization: "Bearer test-secret-abc" }),
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.numbersReset).toBe(7);
        expect(body.cooldownsCleared).toBe(3);
        expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    });
});
