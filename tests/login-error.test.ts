import { describe, it, expect } from "vitest";
import { classifyLoginError } from "@/lib/login-error";

// Regression: a DELETED/paused Supabase project surfaced to the operator as
// "Database connection pool full", because the old inline check matched the
// substring "database" in Prisma's "Can't reach database server" message.
// That sent debugging toward pool sizing instead of toward a dead database.

describe("classifyLoginError - credential failures", () => {
    it("NextAuth CredentialsSignin -> invalid credentials", () => {
        expect(classifyLoginError("CredentialsSignin").kind).toBe("invalid_credentials");
    });
    it("does not leak a DB-shaped message for a plain bad password", () => {
        expect(classifyLoginError("CredentialsSignin").message).toBe("Invalid email or password");
    });
});

describe("classifyLoginError - database unreachable (NOT pool exhaustion)", () => {
    it("Prisma 'Can't reach database server' -> unreachable, not pool", () => {
        const r = classifyLoginError("Can't reach database server at `aws-1-ap-southeast-1.pooler.supabase.com:6543`");
        expect(r.kind).toBe("db_unreachable");
        expect(r.message).not.toMatch(/pool/i);
    });
    it("Supavisor 'tenant/user not found' (paused/deleted project) -> unreachable", () => {
        const r = classifyLoginError("Error querying the database: FATAL: (ENOTFOUND) tenant/user postgres.abc not found");
        expect(r.kind).toBe("db_unreachable");
        expect(r.message).not.toMatch(/pool/i);
    });
    it("P1001 -> unreachable", () => {
        expect(classifyLoginError("P1001: Can't reach database server").kind).toBe("db_unreachable");
    });
});

describe("classifyLoginError - genuine pool exhaustion", () => {
    it("Prisma P2024 pool timeout -> db_busy", () => {
        const r = classifyLoginError("Timed out fetching a new connection from the connection pool");
        expect(r.kind).toBe("db_busy");
        expect(r.message).toMatch(/busy/i);
    });
    it("Supabase 'max clients reached' -> db_busy", () => {
        expect(classifyLoginError("FATAL: sorry, too many clients already / max clients reached").kind).toBe("db_busy");
    });
});

describe("classifyLoginError - fallbacks", () => {
    it("unknown error -> generic", () => {
        expect(classifyLoginError("something exploded").kind).toBe("unknown");
    });
    it("undefined -> generic, no crash", () => {
        expect(classifyLoginError(undefined).kind).toBe("unknown");
    });
    it("unreachable is preferred over busy when both words appear", () => {
        // "Can't reach database server ... (connection pool timeout: 10)" — the
        // reachability failure is the real cause; pool wording is incidental.
        const r = classifyLoginError("Can't reach database server at host:5432 (connection pool timeout: 10)");
        expect(r.kind).toBe("db_unreachable");
    });
});
