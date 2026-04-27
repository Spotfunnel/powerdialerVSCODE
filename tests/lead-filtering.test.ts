import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Characterization tests for the lead filtering & disposition refactor.
 *
 * Scope: PURE LOGIC inside src/lib/dialer-logic.ts
 *  - getNextLead: states[] expansion, skipId/campaignId/forcedLeadId plumbing,
 *    recovery (existing lock) short-circuit, returns-null behavior.
 *  - updateLeadDisposition: dispatch return shape across calendar/sms
 *    success+failure permutations.
 *
 * Prisma is mocked at the module boundary (`@/lib/prisma`).
 *
 * NOTE: getNextLead's actual ordering rules (CALLBACK first, priority ASC,
 * nextCallAt ASC, attempts ASC, updatedAt ASC) live inside a Postgres SQL
 * tagged template literal — we cannot exercise them in a JS unit test.
 * Instead we assert the SQL string includes the expected ORDER BY and that
 * the JS-level filter values (states, skipId, campaignId) are plumbed into
 * the query as bound parameters in the right shape.
 */

// ---- Prisma mock --------------------------------------------------------
const mockQueryRaw = vi.fn();
const mockLeadFindFirst = vi.fn();
const mockLeadFindUnique = vi.fn();
const mockLeadUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockCallFindFirst = vi.fn();
const mockCallUpdate = vi.fn();
const mockCallCreate = vi.fn();
const mockCallbackCreate = vi.fn();
const mockMeetingCreate = vi.fn();
const mockMeetingUpdate = vi.fn();
const mockCalendarConnectionFindUnique = vi.fn();
const mockLeadActivityCreate = vi.fn();
const mockSettingsFindUnique = vi.fn();
const mockNumberPoolFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
    prisma: {
        $queryRaw: (...args: any[]) => mockQueryRaw(...args),
        lead: {
            findFirst: (...a: any[]) => mockLeadFindFirst(...a),
            findUnique: (...a: any[]) => mockLeadFindUnique(...a),
            update: (...a: any[]) => mockLeadUpdate(...a),
        },
        user: { findUnique: (...a: any[]) => mockUserFindUnique(...a) },
        call: {
            findFirst: (...a: any[]) => mockCallFindFirst(...a),
            update: (...a: any[]) => mockCallUpdate(...a),
            create: (...a: any[]) => mockCallCreate(...a),
        },
        callback: { create: (...a: any[]) => mockCallbackCreate(...a) },
        meeting: {
            create: (...a: any[]) => mockMeetingCreate(...a),
            update: (...a: any[]) => mockMeetingUpdate(...a),
        },
        calendarConnection: {
            findUnique: (...a: any[]) => mockCalendarConnectionFindUnique(...a),
        },
        leadActivity: { create: (...a: any[]) => mockLeadActivityCreate(...a) },
        settings: { findUnique: (...a: any[]) => mockSettingsFindUnique(...a) },
        numberPool: { findMany: (...a: any[]) => mockNumberPoolFindMany(...a) },
    },
}));

// number-rotation pulls prisma too, but we also mock its public API to keep
// updateLeadDisposition's getRotatingNumber side-effect free.
vi.mock("@/lib/number-rotation", () => ({
    selectOutboundNumber: vi.fn(async () => null),
}));

import { getNextLead, updateLeadDisposition } from "@/lib/dialer-logic";

beforeEach(() => {
    mockQueryRaw.mockReset();
    mockLeadFindFirst.mockReset();
    mockLeadFindUnique.mockReset();
    mockLeadUpdate.mockReset();
    mockUserFindUnique.mockReset();
    mockCallFindFirst.mockReset();
    mockCallUpdate.mockReset();
    mockCallCreate.mockReset();
    mockCallbackCreate.mockReset();
    mockMeetingCreate.mockReset();
    mockMeetingUpdate.mockReset();
    mockCalendarConnectionFindUnique.mockReset();
    mockLeadActivityCreate.mockReset();
    mockSettingsFindUnique.mockReset();
    mockNumberPoolFindMany.mockReset();

    // sensible defaults
    mockLeadActivityCreate.mockResolvedValue({});
});

// Tagged-template helper: the first arg ($queryRaw receives a TemplateStringsArray
// followed by interpolated values). We verify the values + the joined SQL string.
function lastQueryCall() {
    const call = mockQueryRaw.mock.calls.at(-1);
    if (!call) throw new Error("no $queryRaw calls");
    const [strings, ...values] = call;
    const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
    return { sql, values };
}

// =========================================================================
// getNextLead — recovery / forced / null paths
// =========================================================================

describe("getNextLead - existing lock recovery short-circuits", () => {
    it("returns the existing lock without running an UPDATE query", async () => {
        const existing = { id: "lead-existing", status: "LOCKED", lockedById: "u1" };
        mockLeadFindFirst.mockResolvedValue(existing);

        const out = await getNextLead("u1");

        expect(out).toBe(existing);
        expect(mockQueryRaw).not.toHaveBeenCalled();
        expect(mockLeadFindFirst).toHaveBeenCalledTimes(1);
        // The recovery query must scope to this user + LOCKED status
        const where = mockLeadFindFirst.mock.calls[0][0].where;
        expect(where.lockedById).toBe("u1");
        expect(where.status).toBe("LOCKED");
        expect(where.lockedAt.gte).toBeInstanceOf(Date);
    });
});

describe("getNextLead - forcedLeadId path", () => {
    it("runs the forced UPDATE and returns the first row", async () => {
        const forced = { id: "lead-forced" };
        mockQueryRaw.mockResolvedValueOnce([forced]);

        const out = await getNextLead("u1", "lead-forced");

        expect(out).toEqual(forced);
        expect(mockLeadFindFirst).not.toHaveBeenCalled(); // recovery skipped
        expect(mockQueryRaw).toHaveBeenCalledTimes(1);
        const { values } = lastQueryCall();
        // userId + forcedLeadId must be among the bound params
        expect(values).toEqual(expect.arrayContaining(["u1", "lead-forced"]));
    });

    it("returns null when forced query returns no rows", async () => {
        mockQueryRaw.mockResolvedValueOnce([]);
        const out = await getNextLead("u1", "lead-forced");
        expect(out).toBeNull();
    });

    it("returns null when forced query returns null/undefined", async () => {
        mockQueryRaw.mockResolvedValueOnce(null as any);
        const out = await getNextLead("u1", "lead-forced");
        expect(out).toBeNull();
    });
});

describe("getNextLead - returns null when no leads available", () => {
    it("recovery empty + acquisition empty -> null", async () => {
        mockLeadFindFirst.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValueOnce([]);
        const out = await getNextLead("u1");
        expect(out).toBeNull();
    });

    it("acquisition throws -> null (swallowed by try/catch)", async () => {
        mockLeadFindFirst.mockResolvedValue(null);
        mockQueryRaw.mockRejectedValueOnce(new Error("DB exploded"));
        const out = await getNextLead("u1");
        expect(out).toBeNull();
    });
});

// =========================================================================
// getNextLead - SQL plumbing for new states[] / skipId filters
// =========================================================================

describe("getNextLead - SQL contains the expected priority ordering", () => {
    it("ORDER BY clause uses CALLBACK-first, priority, nextCallAt, attempts, updatedAt", async () => {
        mockLeadFindFirst.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValueOnce([{ id: "x" }]);

        await getNextLead("u1");

        const { sql } = lastQueryCall();
        // Status priority: CALLBACK (0) before READY (1)
        expect(sql).toMatch(/CASE WHEN status = 'CALLBACK' THEN 0 ELSE 1 END ASC/);
        // Manual priority
        expect(sql).toMatch(/priority ASC/);
        // Next-call window
        expect(sql).toMatch(/"nextCallAt" ASC NULLS LAST/);
        // Attempt count ordering
        expect(sql).toMatch(/"attempts" ASC/);
        // Final tiebreaker
        expect(sql).toMatch(/"updatedAt" ASC/);
        // SKIP LOCKED concurrency safety
        expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
        // Eligibility window: READY or CALLBACK whose nextCallAt has arrived
        expect(sql).toMatch(/status = 'READY'/);
        expect(sql).toMatch(/status = 'CALLBACK'/);
        expect(sql).toMatch(/"nextCallAt" <= NOW\(\)/);
    });
});

describe("getNextLead - states[] expansion", () => {
    beforeEach(() => {
        mockLeadFindFirst.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValueOnce([{ id: "lead-1" }]);
    });

    it("expands ['NSW'] -> ['NSW', 'New South Wales']", async () => {
        await getNextLead("u1", undefined, null, ["NSW"]);
        const { values } = lastQueryCall();
        const expanded = values.find(
            (v) => Array.isArray(v) && v.includes("NSW") && v.includes("New South Wales")
        );
        expect(expanded).toBeDefined();
        expect(expanded).toEqual(["NSW", "New South Wales"]);
    });

    it("expands every AU state code to its full name", async () => {
        const codes = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
        const fulls = [
            "New South Wales", "Victoria", "Queensland", "South Australia",
            "Western Australia", "Tasmania", "Northern Territory", "Australian Capital Territory",
        ];
        await getNextLead("u1", undefined, null, codes);
        const { values } = lastQueryCall();
        const expanded = values.find((v) => Array.isArray(v) && v.length === codes.length * 2);
        expect(expanded).toBeDefined();
        expect(expanded).toEqual([...codes, ...fulls]);
    });

    it("preserves unknown state codes (e.g. 'XX' has no full-name mapping)", async () => {
        await getNextLead("u1", undefined, null, ["NSW", "XX"]);
        const { values } = lastQueryCall();
        // 'XX' is kept; only known codes get expanded
        const expanded = values.find(
            (v) => Array.isArray(v) && v.includes("NSW") && v.includes("XX")
        );
        expect(expanded).toEqual(["NSW", "XX", "New South Wales"]);
    });

    it("null states -> bound value is null (no filter applied)", async () => {
        await getNextLead("u1", undefined, null, null);
        const { values } = lastQueryCall();
        // The expandedStates parameter is bound twice (IS NULL + ANY()); both null
        const arrayParams = values.filter((v) => Array.isArray(v));
        expect(arrayParams).toEqual([]); // no array bound
        expect(values).toContain(null);
    });

    it("empty states array -> bound value is null (treated as no filter)", async () => {
        await getNextLead("u1", undefined, null, []);
        const { values } = lastQueryCall();
        const arrayParams = values.filter((v) => Array.isArray(v));
        expect(arrayParams).toEqual([]);
    });
});

describe("getNextLead - skipId plumbing", () => {
    beforeEach(() => {
        mockLeadFindFirst.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValueOnce([{ id: "lead-2" }]);
    });

    it("skipId is bound into the query", async () => {
        await getNextLead("u1", undefined, null, null, "lead-skip-me");
        const { sql, values } = lastQueryCall();
        expect(values).toEqual(expect.arrayContaining(["lead-skip-me"]));
        // The skip clause excludes the offered lead so the dialer can advance
        expect(sql).toMatch(/id != /);
    });

    it("undefined skipId -> bound as null (no-op)", async () => {
        await getNextLead("u1");
        const { values } = lastQueryCall();
        // skipId default is undefined → `skipId || null` becomes null
        expect(values).toContain(null);
    });
});

describe("getNextLead - campaignId plumbing", () => {
    it("campaignId is bound into the query", async () => {
        mockLeadFindFirst.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValueOnce([{ id: "lead-3" }]);

        await getNextLead("u1", undefined, "campaign-abc");

        const { sql, values } = lastQueryCall();
        expect(values).toEqual(expect.arrayContaining(["campaign-abc"]));
        expect(sql).toMatch(/"campaignId" = /);
    });

    it("null campaignId -> bound as null (no campaign filter)", async () => {
        mockLeadFindFirst.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValueOnce([{ id: "lead-4" }]);

        await getNextLead("u1", undefined, null);

        const { values } = lastQueryCall();
        expect(values).toContain(null);
    });
});

// =========================================================================
// updateLeadDisposition — dispatch return shape
// =========================================================================

const baseLead = {
    id: "lead-1",
    attempts: 0,
    firstName: "Bob",
    lastName: "Smith",
    companyName: "ACME",
    email: "bob@acme.test",
    phoneNumber: "+61412345678", // AU mobile (NOT landline) so SMS is allowed
};

function setupDispositionHappyPath(overrides: Partial<typeof baseLead> = {}) {
    mockLeadFindUnique.mockResolvedValue({ ...baseLead, ...overrides });
    mockLeadUpdate.mockResolvedValue({ ...baseLead, ...overrides });
    mockUserFindUnique.mockResolvedValue({
        id: "u1", repPhoneNumber: "+61400000000", name: "Rep", email: "rep@spotfunnel.test",
    });
    mockCallFindFirst.mockResolvedValue(null); // no pre-existing initiated call
    mockCallCreate.mockResolvedValue({ id: "call-1" });
    mockMeetingCreate.mockResolvedValue({
        id: "meeting-1",
        startAt: new Date("2026-05-01T10:00:00Z"),
        endAt: new Date("2026-05-01T10:30:00Z"),
    });
    mockMeetingUpdate.mockResolvedValue({});
    mockCalendarConnectionFindUnique.mockResolvedValue(null);
    mockLeadActivityCreate.mockResolvedValue({});
}

describe("updateLeadDisposition - non-BOOKED dispositions", () => {
    it("NO_ANSWER returns success with empty dispatch object", async () => {
        setupDispositionHappyPath();

        const result = await updateLeadDisposition("lead-1", "u1", { status: "NO_ANSWER" });

        expect(result.success).toBe(true);
        expect(result.dispatch).toEqual({}); // no calendar/sms work
        expect(mockMeetingCreate).not.toHaveBeenCalled();
    });

    it("3rd NO_ANSWER auto-archives the lead (status = ARCHIVED)", async () => {
        setupDispositionHappyPath({ attempts: 2 }); // 3rd attempt
        await updateLeadDisposition("lead-1", "u1", { status: "NO_ANSWER" });
        const updateData = mockLeadUpdate.mock.calls[0][0].data;
        expect(updateData.status).toBe("ARCHIVED");
    });

    it("CALLBACK with nextCallAt creates a Callback row but no dispatch work", async () => {
        setupDispositionHappyPath();
        mockCallbackCreate.mockResolvedValue({ id: "cb-1" });

        const result = await updateLeadDisposition("lead-1", "u1", {
            status: "CALLBACK",
            nextCallAt: "2026-05-02T15:00:00Z",
            notes: "ring back tomorrow",
        });

        expect(result.dispatch).toEqual({});
        expect(mockCallbackCreate).toHaveBeenCalledTimes(1);
    });
});

describe("updateLeadDisposition - BOOKED dispatch return shape", () => {
    it("calendar success + sms success -> { calendar: 'sent', sms: 'sent' }", async () => {
        setupDispositionHappyPath();
        const createGoogleMeeting = vi.fn().mockResolvedValue({
            id: "gcal-1",
            meetingUrl: "https://meet.google.com/abc",
            calendarUrl: "https://calendar.google.com/event/abc",
            provider: "GOOGLE_MEET",
        });
        const sendSMS = vi.fn().mockResolvedValue({ sid: "sm-1" });

        const result = await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z", customMessage: "Confirming!" },
            { createGoogleMeeting, sendSMS },
        );

        expect(result.dispatch.calendar).toBe("sent");
        expect(result.dispatch.sms).toBe("sent");
        expect(result.dispatch.calendarError).toBeUndefined();
        expect(result.dispatch.smsError).toBeUndefined();
        expect(createGoogleMeeting).toHaveBeenCalledTimes(1);
        expect(sendSMS).toHaveBeenCalledTimes(1);
    });

    it("calendar SUCCESS + sms FAILURE -> { calendar: 'sent', sms: 'failed', smsError }", async () => {
        setupDispositionHappyPath();
        const createGoogleMeeting = vi.fn().mockResolvedValue({
            id: "gcal-1", meetingUrl: "https://meet.google.com/abc",
            calendarUrl: "https://calendar.google.com/event/abc", provider: "GOOGLE_MEET",
        });
        const sendSMS = vi.fn().mockRejectedValue(new Error("Twilio 21610: blocked recipient"));

        const result = await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            { createGoogleMeeting, sendSMS },
        );

        expect(result.dispatch.calendar).toBe("sent");
        expect(result.dispatch.sms).toBe("failed");
        expect(result.dispatch.smsError).toMatch(/21610/);
        expect(result.success).toBe(true); // dispatch failures don't fail the disposition
    });

    it("calendar FAILURE + sms SUCCESS -> { calendar: 'failed', calendarError, sms: 'sent' }", async () => {
        setupDispositionHappyPath();
        const createGoogleMeeting = vi.fn().mockRejectedValue(new Error("Google 401: invalid_grant"));
        const sendSMS = vi.fn().mockResolvedValue({ sid: "sm-1" });

        const result = await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            { createGoogleMeeting, sendSMS },
        );

        expect(result.dispatch.calendar).toBe("failed");
        expect(result.dispatch.calendarError).toMatch(/invalid_grant/);
        expect(result.dispatch.sms).toBe("sent");
        expect(result.dispatch.smsError).toBeUndefined();
    });

    it("calendar FAILURE + sms FAILURE -> both 'failed' with both error strings", async () => {
        setupDispositionHappyPath();
        const createGoogleMeeting = vi.fn().mockRejectedValue(new Error("calendar boom"));
        const sendSMS = vi.fn().mockRejectedValue(new Error("sms boom"));

        const result = await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            { createGoogleMeeting, sendSMS },
        );

        expect(result.dispatch.calendar).toBe("failed");
        expect(result.dispatch.calendarError).toMatch(/calendar boom/);
        expect(result.dispatch.sms).toBe("failed");
        expect(result.dispatch.smsError).toMatch(/sms boom/);
    });

    it("AU landline lead -> sms is BLOCKED (not sent, not failed) but calendar still runs", async () => {
        setupDispositionHappyPath({ phoneNumber: "+61298765432" }); // Sydney landline
        const createGoogleMeeting = vi.fn().mockResolvedValue({
            id: "gcal-1", meetingUrl: "https://meet.google.com/abc",
            calendarUrl: "https://calendar.google.com/event/abc", provider: "GOOGLE_MEET",
        });
        const sendSMS = vi.fn();

        const result = await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            { createGoogleMeeting, sendSMS },
        );

        expect(result.dispatch.calendar).toBe("sent");
        expect(result.dispatch.sms).toBe("blocked-landline");
        expect(sendSMS).not.toHaveBeenCalled();
    });

    it("BOOKED with no createGoogleMeeting dep but sms succeeds -> { sms: 'sent' } only", async () => {
        setupDispositionHappyPath();
        const sendSMS = vi.fn().mockResolvedValue({ sid: "sm-1" });

        const result = await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            { sendSMS },
        );

        expect(result.dispatch.calendar).toBeUndefined();
        expect(result.dispatch.sms).toBe("sent");
        expect(sendSMS).toHaveBeenCalledTimes(1);
    });

    it("BOOKED with no deps at all -> dispatch is empty object", async () => {
        setupDispositionHappyPath();

        const result = await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            {}, // no deps
        );

        expect(result.dispatch).toEqual({});
        // Meeting row is still created so the booking is recorded
        expect(mockMeetingCreate).toHaveBeenCalledTimes(1);
    });

    it("calendar success: SMS body includes meet link when includeMeetLink=true", async () => {
        setupDispositionHappyPath();
        const createGoogleMeeting = vi.fn().mockResolvedValue({
            id: "gcal-1", meetingUrl: "https://meet.google.com/xyz",
            calendarUrl: "https://calendar.google.com/event/xyz", provider: "GOOGLE_MEET",
        });
        const sendSMS = vi.fn().mockResolvedValue({ sid: "sm-1" });

        await updateLeadDisposition(
            "lead-1", "u1",
            {
                status: "BOOKED",
                nextCallAt: "2026-05-01T10:00:00Z",
                customMessage: "See you at [LINK]",
                includeMeetLink: true,
            },
            { createGoogleMeeting, sendSMS },
        );

        const smsArg = sendSMS.mock.calls[0][0];
        expect(smsArg.body).toContain("https://meet.google.com/xyz");
        expect(smsArg.body).not.toContain("[LINK]"); // placeholder substituted
    });

    it("calendar FAILURE: includeMeetLink strips [LINK] placeholder rather than sending it raw", async () => {
        setupDispositionHappyPath();
        const createGoogleMeeting = vi.fn().mockRejectedValue(new Error("calendar down"));
        const sendSMS = vi.fn().mockResolvedValue({ sid: "sm-1" });

        await updateLeadDisposition(
            "lead-1", "u1",
            {
                status: "BOOKED",
                nextCallAt: "2026-05-01T10:00:00Z",
                customMessage: "See you at [LINK]",
                includeMeetLink: true,
            },
            { createGoogleMeeting, sendSMS },
        );

        const smsArg = sendSMS.mock.calls[0][0];
        // No raw "[LINK]" should leak through to the customer
        expect(smsArg.body).not.toContain("[LINK]");
    });
});

describe("updateLeadDisposition - error path", () => {
    it("throws when lead not found", async () => {
        mockLeadFindUnique.mockResolvedValue(null);
        await expect(
            updateLeadDisposition("missing", "u1", { status: "NO_ANSWER" }),
        ).rejects.toThrow(/Lead not found/);
    });
});
