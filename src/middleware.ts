import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
    function middleware(req) {
        const url = req.nextUrl.clone();
        const hostname = req.headers.get("host");

        // Force WWW on production
        const targets = ["powerdialer.vercel.app", "getspotfunnel.com"];
        if (process.env.NODE_ENV === "production" &&
            hostname &&
            targets.includes(hostname) &&
            !url.pathname.startsWith('/api/')
        ) {
            return NextResponse.redirect("https://www.getspotfunnel.com" + url.pathname);
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                const path = req.nextUrl.pathname;
                if (path === "/" || path.startsWith("/login")) {
                    return true;
                }
                // Local-dev-only: allow Playwright to drive harness pages
                // without a session. Vercel Preview/Production still require
                // auth because they run with NODE_ENV=production.
                if (
                    process.env.NODE_ENV !== "production" &&
                    path.startsWith("/e2e-test/")
                ) {
                    return true;
                }
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        "/",
        "/login",
        "/dialer/:path*",
        "/messaging/:path*",
        "/inbound/:path*",
        "/callbacks/:path*",
        "/pipeline/:path*",
        "/leaderboard/:path*",
        "/calendar/:path*",
        "/contacts/:path*",
        "/history/:path*",
        "/kpi/:path*",
        "/profile/:path*",
        "/admin/:path*",
        "/import/:path*",
        "/e2e-test/:path*", // dev-only harness — must require auth even if NODE_ENV is misconfigured
    ],
};
