import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const EMAIL = process.env.E2E_USER_EMAIL ?? "leo@getspotfunnel.com";

/**
 * Verifies the SMS toggle button is present in the dialer and that clicking
 * it opens the MessagePanel with the current lead's MessageThread (composer
 * textarea + Send button). Mints a session cookie directly so we don't have
 * to fight NextAuth's localhost CSRF flow.
 */
test("dialer SMS button opens the MessagePanel composer", async ({ page, context }) => {
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
        name: "next-auth.session-token",
        value: token,
        domain: "localhost", path: "/",
        httpOnly: true, secure: false, sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
    }]);
    await context.grantPermissions(["microphone"]);

    await page.goto("/dialer");

    // SMS button only renders when currentLead exists. Wait for the lead to
    // load (button appears) — that's the most direct signal.
    const smsBtn = page.getByRole("button", { name: /^SMS$/ });
    await expect(smsBtn).toBeVisible({ timeout: 25_000 });

    // Open the panel
    await smsBtn.click();

    // Panel slides in — verify the header + composer rendered
    await expect(page.getByRole("heading", { name: /SMS Relay/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder(/type a message/i)).toBeVisible();

    // Close via the panel's own X button — scope to the panel header so we
    // don't accidentally hit the SMS toggle button (which now shows X icon)
    const panelHeader = page.getByRole("heading", { name: /SMS Relay/i }).locator("..").locator("..");
    await panelHeader.locator("button").last().click();
    await expect(page.getByRole("heading", { name: /SMS Relay/i })).toBeHidden({ timeout: 5_000 });
});
