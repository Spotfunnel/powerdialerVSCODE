/**
 * Presence threshold for routing inbound calls.
 *
 * Heartbeat is sent every 45s (PresenceHeartbeat.tsx).
 * Write is throttled in api/user/presence — only persists when lastSeenAt
 * is > 55s stale. So lastSeenAt can legitimately trail the user's actual
 * presence by ~heartbeat + throttle = 90s.
 *
 * If the inbound routing threshold is shorter than this lag, the owner
 * appears OFFLINE for ~30s out of every 90s window even though their tab
 * is open and the heartbeat is firing. The previous threshold was 60s,
 * which produced exactly that intermittent failure mode.
 *
 * 120s = worst-case lag (90s) + safety buffer for mobile tab throttling.
 */
export const USER_ONLINE_THRESHOLD_MS = 120_000;

export function isUserOnline(
    lastSeenAt: Date | string | null | undefined,
    now: Date = new Date(),
): boolean {
    if (!lastSeenAt) return false;
    const seen = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
    if (Number.isNaN(seen.getTime())) return false;
    return now.getTime() - seen.getTime() < USER_ONLINE_THRESHOLD_MS;
}
