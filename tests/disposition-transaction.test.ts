import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for transactional atomicity of updateLeadDisposition.
 *
 * Bug being driven out: the disposition flow performs multiple writes
 * (lead.update + call.update/create + maybe callback.create + maybe meeting.create)
 * with no $transaction wrapping. A failure mid-flow leaves inconsistent state:
 *  - lead unlocked but call still "initiated"
 *  - callback created but lead status not flipped
 *  - meeting row exists but lead still READY
 *
 * Fix: wrap the structural writes (lead + call + optional callback + optional
 * meeting) in a single prisma.$transaction(async tx => ...). External side
 * effects (Google calendar sync, SMS dispatch, leadActivity logs) stay OUTSIDE.
 *
 * These tests pin the structural invariant by asserting that:
 *   (a) prisma.$transaction is called exactly once per disposition
 *   (b) the relevant writes happen on the tx stub, not on top-level prisma
 *   (c) external side effects do NOT happen on the tx stub
 */

// ---- Hoisted mocks -------------------------------------------------------
const {
    mockTopLeadUpdate, mockTxLeadUpdate,
    mockTopCallFindFirst, mockTxCallFindFirst,
    mockTopCallUpdate, mockTxCallUpdate,
    mockTopCallCreate, mockTxCallCreate,
    mockTopCallbackCreate, mockTxCallbackCreate,
    mockTopMeetingCreate, mockTxMeetingCreate,
    mockTopMeetingUpdate,
    mockLeadFindUnique, mockUserFindUnique,
    mockCalendarConnectionFindUnique, mockLeadActivityCreate,
    mockTransaction,
} = vi.hoisted(() => ({
    mockTopLeadUpdate: vi.fn(), mockTxLeadUpdate: vi.fn(),
    mockTopCallFindFirst: vi.fn(), mockTxCallFindFirst: vi.fn(),
    mockTopCallUpdate: vi.fn(), mockTxCallUpdate: vi.fn(),
    mockTopCallCreate: vi.fn(), mockTxCallCreate: vi.fn(),
    mockTopCallbackCreate: vi.fn(), mockTxCallbackCreate: vi.fn(),
    mockTopMeetingCreate: vi.fn(), mockTxMeetingCreate: vi.fn(),
    mockTopMeetingUpdate: vi.fn(),
    mockLeadFindUnique: vi.fn(), mockUserFindUnique: vi.fn(),
    mockCalendarConnectionFindUnique: vi.fn(), mockLeadActivityCreate: vi.fn(),
    mockTransaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
    const tx = {
        lead: { update: (...a: any[]) => mockTxLeadUpdate(...a) },
        call: {
            findFirst: (...a: any[]) => mockTxCallFindFirst(...a),
            update: (...a: any[]) => mockTxCallUpdate(...a),
            create: (...a: any[]) => mockTxCallCreate(...a),
        },
        callback: { create: (...a: any[]) => mockTxCallbackCreate(...a) },
        meeting: { create: (...a: any[]) => mockTxMeetingCreate(...a) },
    };
    return {
        prisma: {
            lead: {
                findUnique: (...a: any[]) => mockLeadFindUnique(...a),
                update: (...a: any[]) => mockTopLeadUpdate(...a),
            },
            user: { findUnique: (...a: any[]) => mockUserFindUnique(...a) },
            call: {
                findFirst: (...a: any[]) => mockTopCallFindFirst(...a),
                update: (...a: any[]) => mockTopCallUpdate(...a),
                create: (...a: any[]) => mockTopCallCreate(...a),
            },
            callback: { create: (...a: any[]) => mockTopCallbackCreate(...a) },
            meeting: {
                create: (...a: any[]) => mockTopMeetingCreate(...a),
                update: (...a: any[]) => mockTopMeetingUpdate(...a),
            },
            calendarConnection: { findUnique: (...a: any[]) => mockCalendarConnectionFindUnique(...a) },
            leadActivity: { create: (...a: any[]) => mockLeadActivityCreate(...a) },
            $transaction: (cb: any) => mockTransaction(cb, tx),
        },
    };
});

vi.mock("@/lib/number-rotation", () => ({
    selectOutboundNumber: vi.fn(async () => null),
}));

import { updateLeadDisposition } from "@/lib/dialer-logic";

const baseLead = {
    id: "lead-1",
    attempts: 0,
    firstName: "Bob",
    lastName: "Smith",
    companyName: "ACME",
    email: "bob@acme.test",
    phoneNumber: "+61412345678",
};

beforeEach(() => {
    vi.clearAllMocks();
    // Default: $transaction passes its callback through against the tx stub
    mockTransaction.mockImplementation((cb: any, tx: any) => cb(tx));

    mockLeadFindUnique.mockResolvedValue(baseLead);
    mockUserFindUnique.mockResolvedValue({
        id: "u1", repPhoneNumber: "+61400000000", name: "Rep", email: "rep@spotfunnel.test",
    });
    mockTxLeadUpdate.mockResolvedValue(baseLead);
    mockTxCallFindFirst.mockResolvedValue(null);
    mockTxCallUpdate.mockResolvedValue({ id: "call-1" });
    mockTxCallCreate.mockResolvedValue({ id: "call-1" });
    mockTxCallbackCreate.mockResolvedValue({ id: "cb-1" });
    mockTxMeetingCreate.mockResolvedValue({
        id: "m-1",
        startAt: new Date("2026-05-01T10:00:00Z"),
        endAt: new Date("2026-05-01T10:30:00Z"),
    });
    mockTopMeetingUpdate.mockResolvedValue({});
    mockCalendarConnectionFindUnique.mockResolvedValue(null);
    mockLeadActivityCreate.mockResolvedValue({});
});

describe("updateLeadDisposition — structural writes are atomic", () => {
    it("NO_ANSWER: lead.update + call.update/create happen inside ONE $transaction", async () => {
        await updateLeadDisposition("lead-1", "u1", { status: "NO_ANSWER" });

        expect(mockTransaction).toHaveBeenCalledTimes(1);
        // Writes ran on the tx stub, NOT on top-level prisma
        expect(mockTxLeadUpdate).toHaveBeenCalledTimes(1);
        expect(mockTopLeadUpdate).not.toHaveBeenCalled();
        // Call write happened (create or update) inside the tx
        const totalTxCallWrites =
            mockTxCallUpdate.mock.calls.length + mockTxCallCreate.mock.calls.length;
        expect(totalTxCallWrites).toBe(1);
        expect(mockTopCallUpdate).not.toHaveBeenCalled();
        expect(mockTopCallCreate).not.toHaveBeenCalled();
    });

    it("CALLBACK: lead.update + call write + callback.create all inside ONE $transaction", async () => {
        await updateLeadDisposition("lead-1", "u1", {
            status: "CALLBACK",
            nextCallAt: "2026-05-02T15:00:00Z",
            notes: "ring back",
        });

        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockTxLeadUpdate).toHaveBeenCalledTimes(1);
        expect(mockTxCallbackCreate).toHaveBeenCalledTimes(1);
        expect(mockTopCallbackCreate).not.toHaveBeenCalled();
    });

    it("BOOKED: lead.update + call write + meeting.create all inside ONE $transaction", async () => {
        await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            {},
        );

        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockTxLeadUpdate).toHaveBeenCalledTimes(1);
        expect(mockTxMeetingCreate).toHaveBeenCalledTimes(1);
        expect(mockTopMeetingCreate).not.toHaveBeenCalled();
    });

    it("BOOKED: meeting.update (Google sync) happens OUTSIDE the transaction (top-level prisma)", async () => {
        const createGoogleMeeting = vi.fn().mockResolvedValue({
            id: "gcal-1",
            meetingUrl: "https://meet.google.com/abc",
            calendarUrl: "https://calendar.google.com/event/abc",
            provider: "GOOGLE_MEET",
        });

        await updateLeadDisposition(
            "lead-1", "u1",
            { status: "BOOKED", nextCallAt: "2026-05-01T10:00:00Z" },
            { createGoogleMeeting },
        );

        // Meeting CREATE is inside tx; meeting UPDATE (with the gcal IDs) is outside
        expect(mockTxMeetingCreate).toHaveBeenCalledTimes(1);
        expect(mockTopMeetingUpdate).toHaveBeenCalledTimes(1);
    });

    it("if call.update throws inside the transaction, the error propagates (rollback contract)", async () => {
        // Force the call write to throw inside the transaction
        mockTxCallFindFirst.mockResolvedValue({ id: "existing-1", fromNumber: "+61400000000" });
        mockTxCallUpdate.mockRejectedValue(new Error("DB down"));

        await expect(
            updateLeadDisposition("lead-1", "u1", { status: "NO_ANSWER" }),
        ).rejects.toThrow(/DB down/);

        // Transaction was attempted exactly once
        expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
});
