import { describe, it, expect } from "vitest";
import { isUserOnline, USER_ONLINE_THRESHOLD_MS } from "@/lib/presence";

/**
 * Heartbeat realities (PresenceHeartbeat.tsx + api/user/presence):
 *  - Heartbeat fires every 45 000 ms
 *  - Presence write is throttled: only writes if lastSeenAt is older than 55 000 ms
 *  - Therefore lastSeenAt can lag the real "user is alive" signal by up to
 *    heartbeat + throttle = ~90 000 ms in the worst case
 *
 * The online threshold must accommodate this lag plus a safety buffer for
 * network latency and tab throttling on mobile browsers.
 */

describe("isUserOnline", () => {
    const now = new Date("2026-04-27T10:00:00.000Z");

    it("treats a fresh heartbeat (5s ago) as online", () => {
        const lastSeen = new Date(now.getTime() - 5_000);
        expect(isUserOnline(lastSeen, now)).toBe(true);
    });

    it("treats a one-heartbeat-old timestamp (45s ago) as online", () => {
        const lastSeen = new Date(now.getTime() - 45_000);
        expect(isUserOnline(lastSeen, now)).toBe(true);
    });

    it("treats a worst-case skew (89s ago) as online — heartbeat + write-throttle window", () => {
        const lastSeen = new Date(now.getTime() - 89_000);
        expect(isUserOnline(lastSeen, now)).toBe(true);
    });

    it("treats a 2-minute-old timestamp as offline", () => {
        const lastSeen = new Date(now.getTime() - 120_000);
        expect(isUserOnline(lastSeen, now)).toBe(false);
    });

    it("treats null lastSeenAt as offline", () => {
        expect(isUserOnline(null, now)).toBe(false);
    });

    it("treats undefined lastSeenAt as offline", () => {
        expect(isUserOnline(undefined, now)).toBe(false);
    });

    it("threshold is at least 90s (covers heartbeat + write throttle)", () => {
        expect(USER_ONLINE_THRESHOLD_MS).toBeGreaterThanOrEqual(90_000);
    });
});
