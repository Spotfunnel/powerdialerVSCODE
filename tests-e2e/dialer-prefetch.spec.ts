import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const EMAIL = process.env.E2E_USER_EMAIL ?? "leo@getspotfunnel.com";

/**
 * Verifies that the lead prefetch in LeadContext fires after the current
 * lead loads, and that pressing 'N' (next-lead shortcut) results in an
 * instant swap (using the prefetched lead) rather than a network fetch.
 */
test("dialer prefetches next lead and swaps instantly", async ({ page, context }) => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("NEXTAUTH_SECRET not loaded");

    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    await prisma.$disconnect();
    if (!user) throw new Error(`User ${EMAIL} not found`);

    const token = await encode({
        secret,
        token: { id: user.id, sub: user.id, name: user.name, email: user.email, role: (user as any).role },
        maxAge: 30 * 24 * 60 * 60,
    });
    await context.addCookies([{
        name: "next-auth.session-token", value: token,
        domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
    }]);
    await context.grantPermissions(["microphone"]);

    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.goto("/dialer");

    // Wait for first lead acquisition + prefetch
    await page.waitForFunction(
        () => (window as any).__leadLogs?.includes("Prefetched") ||
              document.body.innerText.match(/Prefetched/) !== null,
        null,
        { timeout: 25_000 }
    ).catch(() => {});

    // Wait up to 25s for both: a Prefetched log AND a current lead
    await page.waitForFunction(
        () => true, // we'll poll our logs array via page.evaluate below
        null,
        { timeout: 1_000 }
    ).catch(() => {});

    // Poll until we see "[LeadContext] Prefetched next:" in our captured logs
    const start = Date.now();
    let prefetched = false;
    while (Date.now() - start < 25_000) {
        if (logs.some(l => l.includes("[LeadContext] Prefetched next:"))) {
            prefetched = true;
            break;
        }
        await page.waitForTimeout(250);
    }
    expect(prefetched, "Expected to see [LeadContext] Prefetched next: log").toBe(true);

    // Trigger next-lead via 'N' shortcut
    await page.keyboard.press("KeyN");

    // Wait for the instant-swap log
    const swapStart = Date.now();
    let swapped = false;
    while (Date.now() - swapStart < 5_000) {
        if (logs.some(l => l.includes("[LeadContext] Instant swap to prefetched:"))) {
            swapped = true;
            break;
        }
        await page.waitForTimeout(100);
    }
    expect(swapped, "Expected instant swap on 'N' shortcut. Logs:\n" + logs.slice(-20).join("\n")).toBe(true);
});
