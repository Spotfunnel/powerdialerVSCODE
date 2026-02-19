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
        "/admin/:path*",
        "/import/:path*",
    ],
};
