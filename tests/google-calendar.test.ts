/**
 * Characterization tests for the DST-safe slot generator in
 * `src/lib/calendar-logic.ts` (introduced in the wip-checkpoint Google
 * Calendar feature bundle).
 *
 * Scope:
 *   - generateAESTSlots() — DST-aware slot generation across IANA zones,
 *     custom hour ranges, business-hour exclusion, midnight UTC wraparound,
 *     and DST transition days.
 *
 * Out of scope (documented, not tested):
 *   - The Google OAuth callback (src/app/api/integrations/google/callback/route.ts)
 *     and connect (.../connect/route.ts) routes embed all of their email-mismatch /
 *     account-pick logic inline inside async route handlers that pull from
 *     `next-auth`, `googleapis`, `@/lib/prisma`, and `next/server`. There is no
 *     exported helper to unit-test (e.g. no `pickAccountEmail(tokens, session)`
 *     pure function), so testing them would require either spinning up Next +
 *     mocking 4 modules at the import boundary, or refactoring the route to
 *     extract a helper. Both are out of scope for a no-source-changes
 *     characterization pass — the existing behaviour is recorded here in this
 *     comment so a future refactor can extract:
 *       * googleEmail / googleName fetched from `oauth2.userinfo.get()`
 *       * `prompt: "select_account consent"` forced on auth URL
 *       * `senderEmail` / `senderName` written to CalendarConnection upsert
 *       * profile page renders mismatch warning when
 *         `connection.senderEmail !== session.user.email`.
 */

import { describe, it, expect } from "vitest";
import { generateAESTSlots, type TimeSlot } from "@/lib/calendar-logic";

// ---------- helpers ----------

/** Format a UTC Date as YYYY-MM-DDTHH:mm for stable assertions. */
function utcStamp(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Render a slot's start time in a given IANA zone as HH:mm so we can assert
 * "this slot starts at 9:00 local time, regardless of DST".
 */
function localHourMinute(d: Date, timeZone: string): string {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    return fmt.format(d);
}

function localDate(d: Date, timeZone: string): string {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return fmt.format(d);
}

// ---------- shape / defaults ----------

describe("generateAESTSlots — output shape & defaults", () => {
    it("defaults to Australia/Sydney with 9am–7pm window (20 slots × 30min)", () => {
        const baseDate = new Date(Date.UTC(2025, 6, 15, 12, 0, 0)); // 2025-07-15
        const slots = generateAESTSlots(baseDate);
        expect(slots.length).toBe(20); // (19 - 9) * 2 = 20
    });

    it("each slot has start, end, available=true, remainingSeats=2, empty events", () => {
        const slots = generateAESTSlots(new Date(Date.UTC(2025, 6, 15, 12)));
        for (const slot of slots) {
            expect(slot.start).toBeInstanceOf(Date);
            expect(slot.end).toBeInstanceOf(Date);
            expect(slot.available).toBe(true);
            expect(slot.remainingSeats).toBe(2);
            expect(slot.events).toEqual([]);
            // Each slot is exactly 30 minutes
            expect(slot.end.getTime() - slot.start.getTime()).toBe(30 * 60 * 1000);
        }
    });

    it("slots are produced in chronological order, 30min apart", () => {
        const slots = generateAESTSlots(new Date(Date.UTC(2025, 6, 15, 12)));
        for (let i = 1; i < slots.length; i++) {
            expect(slots[i].start.getTime() - slots[i - 1].start.getTime()).toBe(
                30 * 60 * 1000,
            );
        }
    });
});

// ---------- America/New_York: non-DST (EST, UTC-5) ----------

describe("America/New_York — non-DST (winter, EST = UTC-5)", () => {
    // Mid-January is solidly EST. DST in 2025 starts Mar 9.
    const baseDate = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // 2025-01-15

    it("9am NY winter slot resolves to 14:00 UTC (9 + 5)", () => {
        const slots = generateAESTSlots(baseDate, undefined, "America/New_York");
        // First slot is 09:00 NY local
        expect(utcStamp(slots[0].start)).toBe("2025-01-15T14:00");
        expect(localHourMinute(slots[0].start, "America/New_York")).toBe("09:00");
    });

    it("last slot (6:30pm NY local) resolves to 23:30 UTC", () => {
        const slots = generateAESTSlots(baseDate, undefined, "America/New_York");
        const last = slots[slots.length - 1];
        expect(utcStamp(last.start)).toBe("2025-01-15T23:30");
        expect(localHourMinute(last.start, "America/New_York")).toBe("18:30");
    });
});

// ---------- America/New_York: DST (EDT, UTC-4) ----------

describe("America/New_York — DST (summer, EDT = UTC-4)", () => {
    const baseDate = new Date(Date.UTC(2025, 6, 15, 12, 0, 0)); // 2025-07-15

    it("9am NY summer slot resolves to 13:00 UTC (9 + 4), proving DST is honored", () => {
        const slots = generateAESTSlots(baseDate, undefined, "America/New_York");
        expect(utcStamp(slots[0].start)).toBe("2025-07-15T13:00");
        expect(localHourMinute(slots[0].start, "America/New_York")).toBe("09:00");
    });

    it("summer 6:30pm NY local resolves to 22:30 UTC", () => {
        const slots = generateAESTSlots(baseDate, undefined, "America/New_York");
        const last = slots[slots.length - 1];
        expect(utcStamp(last.start)).toBe("2025-07-15T22:30");
        expect(localHourMinute(last.start, "America/New_York")).toBe("18:30");
    });

    it("winter and summer 9am NY slots differ by exactly 1 hour in UTC", () => {
        const winter = generateAESTSlots(
            new Date(Date.UTC(2025, 0, 15, 12)),
            undefined,
            "America/New_York",
        );
        const summer = generateAESTSlots(
            new Date(Date.UTC(2025, 6, 15, 12)),
            undefined,
            "America/New_York",
        );
        const winterUtcHour = winter[0].start.getUTCHours();
        const summerUtcHour = summer[0].start.getUTCHours();
        expect(winterUtcHour - summerUtcHour).toBe(1); // EST is one hour later in UTC than EDT
    });
});

// ---------- Australia/Sydney: AEST (winter, UTC+10) ----------

describe("Australia/Sydney — AEST (southern winter, UTC+10)", () => {
    // Sydney DST is OFF from ~April through ~October. Mid-July is solidly AEST.
    const baseDate = new Date(Date.UTC(2025, 6, 15, 12, 0, 0)); // 2025-07-15

    it("9am Sydney winter slot resolves to 23:00 UTC of the previous day (9 - 10 wraps)", () => {
        const slots = generateAESTSlots(baseDate, undefined, "Australia/Sydney");
        // 9am AEST = 23:00 UTC of 2025-07-14 (midnight wraparound!)
        expect(utcStamp(slots[0].start)).toBe("2025-07-14T23:00");
        expect(localHourMinute(slots[0].start, "Australia/Sydney")).toBe("09:00");
        expect(localDate(slots[0].start, "Australia/Sydney")).toBe("2025-07-15");
    });
});

// ---------- Australia/Sydney: AEDT (summer, UTC+11) ----------

describe("Australia/Sydney — AEDT (southern summer, UTC+11)", () => {
    const baseDate = new Date(Date.UTC(2025, 11, 15, 12, 0, 0)); // 2025-12-15

    it("9am Sydney summer slot resolves to 22:00 UTC of the previous day (9 - 11 wraps)", () => {
        const slots = generateAESTSlots(baseDate, undefined, "Australia/Sydney");
        // 9am AEDT = 22:00 UTC of 2025-12-14
        expect(utcStamp(slots[0].start)).toBe("2025-12-14T22:00");
        expect(localHourMinute(slots[0].start, "Australia/Sydney")).toBe("09:00");
        expect(localDate(slots[0].start, "Australia/Sydney")).toBe("2025-12-15");
    });

    it("Sydney winter vs summer: same local 9am differs by 1h in UTC", () => {
        const winter = generateAESTSlots(
            new Date(Date.UTC(2025, 6, 15, 12)),
            undefined,
            "Australia/Sydney",
        );
        const summer = generateAESTSlots(
            new Date(Date.UTC(2025, 11, 15, 12)),
            undefined,
            "Australia/Sydney",
        );
        // AEST(+10) winter 9am -> 23:00 UTC; AEDT(+11) summer 9am -> 22:00 UTC.
        // i.e. AEST is one hour later in UTC than AEDT — proves DST is honoured.
        expect(winter[0].start.getUTCHours()).toBe(23);
        expect(summer[0].start.getUTCHours()).toBe(22);
        expect(winter[0].start.getUTCHours() - summer[0].start.getUTCHours()).toBe(1);
    });
});

// ---------- Custom startHour / endHour ----------

describe("custom startHour / endHour", () => {
    const baseDate = new Date(Date.UTC(2025, 6, 15, 12)); // 2025-07-15

    it("startHour=10, endHour=14 => 8 slots (10, 10:30, 11, 11:30, 12, 12:30, 13, 13:30)", () => {
        const slots = generateAESTSlots(
            baseDate,
            undefined,
            "America/New_York",
            10,
            14,
        );
        expect(slots.length).toBe(8);
        expect(localHourMinute(slots[0].start, "America/New_York")).toBe("10:00");
        expect(localHourMinute(slots[slots.length - 1].start, "America/New_York")).toBe(
            "13:30",
        );
    });

    it("startHour === endHour produces 0 slots", () => {
        const slots = generateAESTSlots(baseDate, undefined, "America/New_York", 9, 9);
        expect(slots.length).toBe(0);
    });

    it("narrow business window: 12 to 13 => 2 slots (12:00, 12:30)", () => {
        const slots = generateAESTSlots(
            baseDate,
            undefined,
            "America/New_York",
            12,
            13,
        );
        expect(slots.length).toBe(2);
        expect(localHourMinute(slots[0].start, "America/New_York")).toBe("12:00");
        expect(localHourMinute(slots[1].start, "America/New_York")).toBe("12:30");
    });

    it("excludes anything before startHour or at/after endHour (no leakage)", () => {
        const slots = generateAESTSlots(
            baseDate,
            undefined,
            "America/New_York",
            10,
            12,
        );
        for (const slot of slots) {
            const hhmm = localHourMinute(slot.start, "America/New_York");
            const [hh, mm] = hhmm.split(":").map(Number);
            // startHour <= h < endHour
            expect(hh).toBeGreaterThanOrEqual(10);
            expect(hh).toBeLessThan(12);
            expect([0, 30]).toContain(mm);
        }
    });
});

// ---------- Explicit `offset` arg overrides timezone math ----------

describe("explicit offset arg (legacy callers)", () => {
    it("when offset is supplied, IANA timezone is ignored", () => {
        const baseDate = new Date(Date.UTC(2025, 6, 15, 12));
        const withOffset = generateAESTSlots(baseDate, 11, "America/New_York");
        // Treat the local-9am as UTC+11 even though we passed NY.
        // 9am at UTC+11 -> 22:00 UTC of previous day.
        expect(utcStamp(withOffset[0].start)).toBe("2025-07-14T22:00");
    });

    it("offset=0 means local = UTC (9am local -> 09:00 UTC)", () => {
        const baseDate = new Date(Date.UTC(2025, 6, 15, 12));
        const slots = generateAESTSlots(baseDate, 0, "Etc/UTC");
        expect(utcStamp(slots[0].start)).toBe("2025-07-15T09:00");
    });
});

// ---------- DST transition days (edge cases) ----------

describe("DST transition days", () => {
    /*
     * The implementation samples the timezone's offset at *UTC noon* of the
     * target calendar day to pick a single offset for the whole day. So on a
     * spring-forward / fall-back day, it commits to the post-transition offset
     * (since the transition occurs early-morning local time, well before 12:00
     * UTC for both NY and Sydney). These tests pin that documented behaviour.
     */

    it("US spring-forward day (2025-03-09): NY uses EDT (UTC-4) at noon UTC", () => {
        const baseDate = new Date(Date.UTC(2025, 2, 9, 12)); // 2025-03-09
        const slots = generateAESTSlots(baseDate, undefined, "America/New_York");
        // 9am EDT = 13:00 UTC same day
        expect(utcStamp(slots[0].start)).toBe("2025-03-09T13:00");
        expect(localHourMinute(slots[0].start, "America/New_York")).toBe("09:00");
    });

    it("US fall-back day (2025-11-02): NY uses EST (UTC-5) at noon UTC", () => {
        const baseDate = new Date(Date.UTC(2025, 10, 2, 12)); // 2025-11-02
        const slots = generateAESTSlots(baseDate, undefined, "America/New_York");
        // After fall-back, 9am EST = 14:00 UTC same day
        expect(utcStamp(slots[0].start)).toBe("2025-11-02T14:00");
        expect(localHourMinute(slots[0].start, "America/New_York")).toBe("09:00");
    });

    it("Sydney spring-forward day (2025-10-05): uses AEDT (UTC+11) at noon UTC", () => {
        const baseDate = new Date(Date.UTC(2025, 9, 5, 12)); // 2025-10-05
        const slots = generateAESTSlots(baseDate, undefined, "Australia/Sydney");
        // After spring-forward, 9am AEDT = 22:00 UTC of the previous day
        expect(utcStamp(slots[0].start)).toBe("2025-10-04T22:00");
        expect(localHourMinute(slots[0].start, "Australia/Sydney")).toBe("09:00");
    });

    it("Sydney fall-back day (2025-04-06): uses AEST (UTC+10) at noon UTC", () => {
        const baseDate = new Date(Date.UTC(2025, 3, 6, 12)); // 2025-04-06
        const slots = generateAESTSlots(baseDate, undefined, "Australia/Sydney");
        // After fall-back, 9am AEST = 23:00 UTC of the previous day
        expect(utcStamp(slots[0].start)).toBe("2025-04-05T23:00");
        expect(localHourMinute(slots[0].start, "Australia/Sydney")).toBe("09:00");
    });
});

// ---------- Midnight UTC wraparound ----------

describe("midnight UTC wraparound", () => {
    it("Sydney AEDT 9am wraps into the previous UTC date correctly", () => {
        const baseDate = new Date(Date.UTC(2026, 0, 15, 12)); // 2026-01-15 (AEDT)
        const slots = generateAESTSlots(baseDate, undefined, "Australia/Sydney");
        // 9am AEDT (+11) -> 22:00 UTC of 2026-01-14
        expect(slots[0].start.getUTCDate()).toBe(14);
        expect(slots[0].start.getUTCHours()).toBe(22);
        // But local Sydney calendar date is still 2026-01-15
        expect(localDate(slots[0].start, "Australia/Sydney")).toBe("2026-01-15");
    });

    it("month/year boundary: Jan 1 in Sydney AEDT wraps into Dec 31 UTC", () => {
        const baseDate = new Date(Date.UTC(2026, 0, 1, 12)); // 2026-01-01
        const slots = generateAESTSlots(baseDate, undefined, "Australia/Sydney");
        // 9am AEDT on 2026-01-01 -> 22:00 UTC on 2025-12-31
        expect(slots[0].start.getUTCFullYear()).toBe(2025);
        expect(slots[0].start.getUTCMonth()).toBe(11); // December (0-indexed)
        expect(slots[0].start.getUTCDate()).toBe(31);
        expect(slots[0].start.getUTCHours()).toBe(22);
        expect(localDate(slots[0].start, "Australia/Sydney")).toBe("2026-01-01");
    });

    it("UTC zone with no offset never wraps (sanity)", () => {
        const baseDate = new Date(Date.UTC(2025, 6, 15, 12));
        const slots = generateAESTSlots(baseDate, 0, "Etc/UTC");
        for (const slot of slots) {
            expect(slot.start.getUTCDate()).toBe(15);
        }
    });
});

// ---------- TimeSlot interface compile-time check ----------

describe("TimeSlot interface", () => {
    it("returned slots match the TimeSlot type", () => {
        const slots: TimeSlot[] = generateAESTSlots(new Date(Date.UTC(2025, 6, 15, 12)));
        expect(slots.length).toBeGreaterThan(0);
        // remainingSeats and available are present on every slot
        for (const s of slots) {
            expect(typeof s.available).toBe("boolean");
            expect(typeof s.remainingSeats).toBe("number");
        }
    });
});
