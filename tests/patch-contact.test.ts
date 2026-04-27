import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetServerSession = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("next-auth/next", () => ({
    getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
    prisma: {
        lead: {
            update: (...args: any[]) => mockUpdate(...args),
            findUnique: (...args: any[]) => mockFindUnique(...args),
        },
    },
}));

import { PATCH } from "@/app/api/crm/contacts/[id]/route";

function makeReq(body: any) {
    return new Request("http://localhost/api/crm/contacts/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

const ctx = { params: { id: "lead-123" } };
const session = { user: { id: "u1", email: "u1@example.com" } };

beforeEach(() => {
    mockGetServerSession.mockReset();
    mockUpdate.mockReset();
    mockFindUnique.mockReset();
});

describe("PATCH /api/crm/contacts/[id] - auth", () => {
    it("returns 401 when no session", async () => {
        mockGetServerSession.mockResolvedValue(null);
        const res = await PATCH(makeReq({ firstName: "Bob" }), ctx as any);
        expect(res.status).toBe(401);
    });

    it("returns 401 when session has no user", async () => {
        mockGetServerSession.mockResolvedValue({});
        const res = await PATCH(makeReq({ firstName: "Bob" }), ctx as any);
        expect(res.status).toBe(401);
    });
});

describe("PATCH /api/crm/contacts/[id] - happy path", () => {
    it("updates a full payload and normalizes phone", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123", phoneNumber: "+61412345678" });

        const res = await PATCH(makeReq({
            companyName: "ACME",
            firstName: "Bob",
            lastName: "Smith",
            email: "bob@acme.test",
            phoneNumber: "0412 345 678",
            suburb: "Sydney",
            state: "NSW",
            industry: "Plumbing",
            status: "INTERESTED",
            website: "acme.test",
            notes: "follow up tuesday",
        }), ctx as any);

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: "lead-123" },
            data: expect.objectContaining({
                companyName: "ACME",
                firstName: "Bob",
                phoneNumber: "+61412345678",
                status: "INTERESTED",
                website: "acme.test",
                notes: "follow up tuesday",
            }),
        });
    });

    it("partial update only includes provided fields", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });

        await PATCH(makeReq({ status: "BOOKED" }), ctx as any);

        const data = mockUpdate.mock.calls[0][0].data;
        expect(data).toEqual({ status: "BOOKED" });
        expect(data.firstName).toBeUndefined();
        expect(data.phoneNumber).toBeUndefined();
    });

    it("status field is preserved even if value is empty string", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });

        await PATCH(makeReq({ status: "" }), ctx as any);

        const data = mockUpdate.mock.calls[0][0].data;
        expect(data.status).toBe("");
    });
});

describe("PATCH /api/crm/contacts/[id] - phone validation", () => {
    it("returns 400 on invalid phone string", async () => {
        mockGetServerSession.mockResolvedValue(session);
        const res = await PATCH(makeReq({ phoneNumber: "not a phone" }), ctx as any);
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("normalizes US phone to +1 form", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });
        await PATCH(makeReq({ phoneNumber: "(850) 439-0035" }), ctx as any);
        expect(mockUpdate.mock.calls[0][0].data.phoneNumber).toBe("+18504390035");
    });

    it("collapses doubled country codes (+61+61...)", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });
        await PATCH(makeReq({ phoneNumber: "+61+61412345678" }), ctx as any);
        expect(mockUpdate.mock.calls[0][0].data.phoneNumber).toBe("+61412345678");
    });
});

describe("PATCH /api/crm/contacts/[id] - error mapping", () => {
    it("maps Prisma P2002 to 409 Conflict", async () => {
        mockGetServerSession.mockResolvedValue(session);
        const err: any = new Error("Unique constraint");
        err.code = "P2002";
        mockUpdate.mockRejectedValue(err);

        const res = await PATCH(makeReq({ phoneNumber: "0412345678" }), ctx as any);
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toMatch(/already exists/i);
    });

    it("maps generic Prisma error to 500", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockRejectedValue(new Error("DB exploded"));

        const res = await PATCH(makeReq({ firstName: "Bob" }), ctx as any);
        expect(res.status).toBe(500);
    });
});

describe("PATCH /api/crm/contacts/[id] - stress / weird inputs", () => {
    it("accepts very long notes (10kb)", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });
        const big = "x".repeat(10_000);
        await PATCH(makeReq({ notes: big }), ctx as any);
        expect(mockUpdate.mock.calls[0][0].data.notes).toBe(big);
    });

    it("preserves unicode in firstName", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });
        await PATCH(makeReq({ firstName: "Renée 中文 🚀" }), ctx as any);
        expect(mockUpdate.mock.calls[0][0].data.firstName).toBe("Renée 中文 🚀");
    });

    it("does NOT execute scripts in notes (stored as plain string)", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });
        const xss = "<script>alert(1)</script>";
        await PATCH(makeReq({ notes: xss }), ctx as any);
        // Stored verbatim - rendering layer handles escaping
        expect(mockUpdate.mock.calls[0][0].data.notes).toBe(xss);
    });

    it("empty body is a no-op update (sends empty data)", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });
        await PATCH(makeReq({}), ctx as any);
        expect(mockUpdate.mock.calls[0][0].data).toEqual({});
    });

    it("empty string fields collapse to undefined (not blanked out)", async () => {
        mockGetServerSession.mockResolvedValue(session);
        mockUpdate.mockResolvedValue({ id: "lead-123" });
        await PATCH(makeReq({ firstName: "", email: "" }), ctx as any);
        const data = mockUpdate.mock.calls[0][0].data;
        expect(data.firstName).toBeUndefined();
        expect(data.email).toBeUndefined();
    });

    it("malformed JSON body returns 500 (not crash)", async () => {
        mockGetServerSession.mockResolvedValue(session);
        const req = new Request("http://localhost/x", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: "{ not json",
        });
        const res = await PATCH(req, ctx as any);
        expect(res.status).toBe(500);
    });
});
