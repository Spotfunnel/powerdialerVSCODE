/**
 * Maps a NextAuth `signIn` error string to an operator-facing message.
 *
 * Kept deliberately narrow: the previous inline version treated *any* error
 * mentioning "database" or "connection" as pool exhaustion, so a paused or
 * deleted Postgres project rendered as "connection pool full" — pointing the
 * operator at pool sizing when the database was simply not there.
 *
 * Order matters: reachability is checked before saturation, because Prisma's
 * unreachable-server message can itself mention the connection pool.
 */

export type LoginErrorKind =
    | "invalid_credentials"
    | "db_unreachable"
    | "db_busy"
    | "unknown";

export interface LoginErrorInfo {
    kind: LoginErrorKind;
    message: string;
}

// Server is up but has no free connection for us.
const BUSY_PATTERNS = [
    "timed out fetching a new connection",
    "connection pool timeout",
    "max clients reached",
    "maxclientsinsessionmode",
    "too many clients",
];

// Server is absent, asleep, or does not recognise the tenant at all.
const UNREACHABLE_PATTERNS = [
    "can't reach database",
    "cant reach database",
    "tenant/user",           // Supavisor: project paused/deleted/wrong region
    "enotfound",
    "econnrefused",
    "etimedout",
    "p1001",                 // Prisma: can't reach database server
    "p1017",                 // Prisma: server closed the connection
];

export function classifyLoginError(raw: string | null | undefined): LoginErrorInfo {
    const err = (raw ?? "").toLowerCase();

    if (!err) {
        return { kind: "unknown", message: "Login failed. Please try again." };
    }

    // NextAuth's sentinel for "authorize() returned null" — a normal bad login.
    if (err === "credentialssignin") {
        return { kind: "invalid_credentials", message: "Invalid email or password" };
    }

    if (UNREACHABLE_PATTERNS.some(p => err.includes(p))) {
        return {
            kind: "db_unreachable",
            message: "Can't reach the database. It may be paused or offline — this is not a password problem.",
        };
    }

    if (BUSY_PATTERNS.some(p => err.includes(p))) {
        return {
            kind: "db_busy",
            message: "Server is busy (database connections saturated). Please wait a moment and try again.",
        };
    }

    return { kind: "unknown", message: "Login failed. Please try again." };
}
