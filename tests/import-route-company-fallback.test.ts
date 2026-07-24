import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/crm/import POST handler — specifically the "Unknown Company"
 * regression. CSVs without a recognised company column previously had every
 * row stamped with the literal string "Unknown Company" via createMany.
 *
 * Contract pinned by these tests:
 *  - createMany is NEVER called with companyName === "Unknown Company"
 *  - createMany falls back to firstName+lastName, then phoneNumber
 *  - updates only set companyName when the CSV row actually had one
 *  - broadened header matcher recognises "Organisation", "Account", etc.
 */

// ---- Hoisted mocks -------------------------------------------------------
const {
    mockLeadCreateMany,
    mockLeadFindMany,
    mockLeadUpdate,
    mockTransaction,
    mockGetServerSession,
} = vi.hoisted(() => ({
    mockLeadCreateMany: vi.fn(),
    mockLeadFindMany: vi.fn(),
    mockLeadUpdate: vi.fn(),
    mockTransaction: vi.fn(),
    mockGetServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
    const proxy: any = {
        lead: {
            createMany: mockLeadCreateMany,
            findMany: mockLeadFindMany,
            update: mockLeadUpdate,
        },
        $transaction: mockTransaction,
    };
    return { prisma: proxy, prismaDirect: proxy, withPrismaRetry: async <T,>(fn: () => Promise<T>) => fn() };
});

vi.mock("next-auth/next", () => ({
    getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/crm/import/route";

function jsonRequest(body: unknown): Request {
    return new Request("https://app.example.com/api/crm/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    mockLeadFindMany.mockResolvedValue([]); // no existing leads → all create
    mockLeadCreateMany.mockResolvedValue({ count: 0 });
    // $transaction(args) when args is an array of promises just resolves them
    mockTransaction.mockImplementation(async (arg: any) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        if (typeof arg === "function") return arg({});
        return arg;
    });
});

describe("CRM import — never writes 'Unknown Company' sentinel", () => {
    it("CSV without a company column falls back to phone number (NEVER firstName/lastName)", async () => {
        const rows = [
            "First Name,Last Name,Phone",
            "Jane,Doe,0412345678",
            "Bob,Smith,+15551234567",
        ];
        await POST(jsonRequest({ rows }));

        expect(mockLeadCreateMany).toHaveBeenCalledTimes(1);
        const [{ data }] = mockLeadCreateMany.mock.calls[0];
        for (const row of data) {
            expect(row.companyName).not.toBe("Unknown Company");
            expect(row.companyName).not.toBe("Unknown Caller");
            expect(row.companyName).not.toBe("Unknown");
            // Person names must NOT leak into the company field
            expect(row.companyName).not.toBe("Jane Doe");
            expect(row.companyName).not.toBe("Bob Smith");
            expect(row.companyName).toBeTruthy();
        }
        expect(data[0].companyName).toBe(data[0].phoneNumber);
        expect(data[1].companyName).toBe(data[1].phoneNumber);
    });

    it("CSV without a company column AND missing names falls back to phone number", async () => {
        const rows = [
            "Phone",
            "0412345678",
        ];
        await POST(jsonRequest({ rows }));

        const [{ data }] = mockLeadCreateMany.mock.calls[0];
        expect(data[0].companyName).not.toBe("Unknown Company");
        // Phone is normalised — just assert the sentinel is NOT used and we have something truthy
        expect(typeof data[0].companyName).toBe("string");
        expect(data[0].companyName.length).toBeGreaterThan(0);
        expect(data[0].companyName).toBe(data[0].phoneNumber);
    });

    it("CSV with empty company cells uses phone fallback per-row (not sentinel, not name)", async () => {
        const rows = [
            "Company,First Name,Last Name,Phone",
            ",Jane,Doe,0412345678",            // empty company → fallback to phone
            "Acme Corp,Bob,Smith,+15551234567", // real company kept
        ];
        await POST(jsonRequest({ rows }));

        const [{ data }] = mockLeadCreateMany.mock.calls[0];
        expect(data[0].companyName).toBe(data[0].phoneNumber);
        expect(data[0].companyName).not.toBe("Jane Doe");
        expect(data[1].companyName).toBe("Acme Corp");
    });

    it("recognises 'Organisation' as a company column", async () => {
        const rows = [
            "Organisation,Phone",
            "Pacific Holdings,0412345678",
        ];
        await POST(jsonRequest({ rows }));

        const [{ data }] = mockLeadCreateMany.mock.calls[0];
        expect(data[0].companyName).toBe("Pacific Holdings");
    });

    it("recognises 'Account Name' as a company column", async () => {
        const rows = [
            "Account Name,Phone",
            "Big Client Inc,0412345678",
        ];
        await POST(jsonRequest({ rows }));

        const [{ data }] = mockLeadCreateMany.mock.calls[0];
        expect(data[0].companyName).toBe("Big Client Inc");
    });

    it("recognises 'Practice Name' as a company column (chiropractor CSVs etc.)", async () => {
        const rows = [
            "Practice Name,Phone",
            "Sydney Spine Clinic,0412345678",
        ];
        await POST(jsonRequest({ rows }));

        const [{ data }] = mockLeadCreateMany.mock.calls[0];
        expect(data[0].companyName).toBe("Sydney Spine Clinic");
    });
});

describe("CRM import — update path does not clobber existing real names with fallbacks", () => {
    it("does NOT include companyName in update when CSV row had no real company value", async () => {
        // Existing lead present so the row goes down the update path
        mockLeadFindMany.mockResolvedValue([{ phoneNumber: "+61412345678" }]);

        const rows = [
            "First Name,Last Name,Phone",
            "Jane,Doe,0412345678",
        ];
        await POST(jsonRequest({ rows }));

        // The update-batch transaction must have been invoked, and the data
        // passed into prisma.lead.update must not include a companyName key.
        expect(mockLeadUpdate).toHaveBeenCalled();
        const updateArg = mockLeadUpdate.mock.calls[0][0];
        expect(updateArg.data.companyName).toBeUndefined();
    });

    it("DOES include companyName in update when CSV row provides a real one", async () => {
        mockLeadFindMany.mockResolvedValue([{ phoneNumber: "+61412345678" }]);

        const rows = [
            "Company,Phone",
            "Acme Corp,0412345678",
        ];
        await POST(jsonRequest({ rows }));

        expect(mockLeadUpdate).toHaveBeenCalled();
        const updateArg = mockLeadUpdate.mock.calls[0][0];
        expect(updateArg.data.companyName).toBe("Acme Corp");
    });
});
