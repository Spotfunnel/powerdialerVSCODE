import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Guards the admin API perimeter. src/middleware.ts's matcher does NOT cover
 * /api/**, so every /api/admin/** route is its own gate. Several routes shipped
 * with NO guard (fix-all/fix-number could rewrite webhooks on EVERY Twilio
 * number in the account, unauthenticated). requireAdmin() is the shared gate.
 */

const { mockGetServerSession } = vi.hoisted(() => ({ mockGetServerSession: vi.fn() }));
vi.mock("next-auth/next", () => ({ getServerSession: (...a: any[]) => mockGetServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { requireAdmin } from "@/lib/require-admin";

beforeEach(() => vi.clearAllMocks());

describe("requireAdmin", () => {
    it("no session -> 401 response", async () => {
        mockGetServerSession.mockResolvedValue(null);
        const r = await requireAdmin();
        expect(r).not.toBeNull();
        expect(r!.status).toBe(401);
    });

    it("authenticated non-admin (REP) -> 401 response", async () => {
        mockGetServerSession.mockResolvedValue({ user: { id: "u1", role: "REP" } });
        const r = await requireAdmin();
        expect(r).not.toBeNull();
        expect(r!.status).toBe(401);
    });

    it("session with no role -> 401 response", async () => {
        mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
        const r = await requireAdmin();
        expect(r!.status).toBe(401);
    });

    it("ADMIN -> null (allowed through)", async () => {
        mockGetServerSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
        const r = await requireAdmin();
        expect(r).toBeNull();
    });
});
