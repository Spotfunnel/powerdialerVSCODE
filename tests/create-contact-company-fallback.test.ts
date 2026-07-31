import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression: creating a contact with NO company name returned HTTP 500
 * ("Argument `companyName` is missing"), because the handler wrote
 * `companyName: companyName || undefined` and Lead.companyName is a required
 * (non-null) column. Reps who left Company blank could not save a contact.
 *
 * Fix: fall back to fallbackCompanyName({ phoneNumber }) (the phone number),
 * which the display layer (displayCompanyName) already renders cleanly.
 */

const mockGetServerSession = vi.fn();
const mockCreate = vi.fn();

vi.mock("next-auth/next", () => ({
    getServerSession: (...a: any[]) => mockGetServerSession(...a),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
    prisma: { lead: { create: (...a: any[]) => mockCreate(...a) } },
}));

import { POST } from "@/app/api/crm/contacts/route";

function makeReq(body: any) {
    return new Request("http://localhost/api/crm/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    mockGetServerSession.mockReset();
    mockCreate.mockReset();
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", email: "u1@example.com" } });
    mockCreate.mockImplementation(async ({ data }: any) => ({ id: "new-1", ...data }));
});

describe("POST /api/crm/contacts - companyName fallback", () => {
    it("saves (200) with no company name, writing the phone number as companyName", async () => {
        const res = await POST(makeReq({ firstName: "Jo", phoneNumber: "0412345678" }));
        expect(res.status).toBe(200);
        const arg = mockCreate.mock.calls[0][0].data;
        expect(arg.companyName).toBe("+61412345678"); // fallback = normalized phone
        expect(arg.companyName).not.toBeUndefined();
    });

    it("keeps a real company name when provided", async () => {
        const res = await POST(makeReq({ firstName: "Jo", phoneNumber: "0412345678", companyName: "Acme Pty" }));
        expect(res.status).toBe(200);
        expect(mockCreate.mock.calls[0][0].data.companyName).toBe("Acme Pty");
    });

    it("treats a blank/whitespace company name as missing (uses fallback)", async () => {
        const res = await POST(makeReq({ firstName: "Jo", phoneNumber: "0412345678", companyName: "   " }));
        expect(res.status).toBe(200);
        expect(mockCreate.mock.calls[0][0].data.companyName).toBe("+61412345678");
    });

    it("still 400s when phone is missing", async () => {
        const res = await POST(makeReq({ firstName: "Jo" }));
        expect(res.status).toBe(400);
    });
});
