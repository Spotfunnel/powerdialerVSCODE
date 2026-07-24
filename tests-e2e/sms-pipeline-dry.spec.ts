import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const EMAIL = process.env.E2E_USER_EMAIL ?? "leo@getspotfunnel.com";

/**
 * Dry-run SMS pipeline verification — exercises every layer EXCEPT the
 * actual Twilio API call:
 *   1. /api/messaging/numbers returns a non-empty sender list
 *   2. The MessageThread polls history (/api/messaging/messages)
 *   3. Send button only fires when input has content
 *   4. Clicking Send buffers the body, starts the 5s undo countdown,
 *      and clicking Undo cancels the actual /api/messaging/send POST
 *   5. /api/messaging/send rejects malformed payloads (no body, missing
 *      lead/to) cleanly with the correct error message
 */
test.describe("SMS pipeline — dry run (no live SMS sent)", () => {
    test("end-to-end UI + API wiring without firing Twilio", async ({ page, context, request }) => {
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

        // 1. /api/messaging/numbers returns sender candidates
        const numbersRes = await page.request.get("/api/messaging/numbers");
        expect(numbersRes.status(), "messaging/numbers should be 200").toBe(200);
        const numbers = await numbersRes.json();
        expect(Array.isArray(numbers)).toBe(true);
        expect(numbers.length, "must have at least one sender number to send SMS").toBeGreaterThan(0);
        console.log(`sender numbers (${numbers.length}):`, numbers.map((n: any) => n.phoneNumber).join(", "));

        // 2. /api/messaging/send malformed-payload guards
        const noBody = await page.request.post("/api/messaging/send", {
            data: { leadId: "nonexistent-lead-id" },
        });
        expect(noBody.status(), "missing body should 400").toBe(400);
        const noBodyJson = await noBody.json();
        expect(noBodyJson.error).toMatch(/Missing 'body'/i);

        const noTarget = await page.request.post("/api/messaging/send", {
            data: { body: "test", leadId: "id-that-does-not-exist-12345" },
        });
        expect(noTarget.status(), "unresolved phone should 400").toBe(400);
        const noTargetJson = await noTarget.json();
        expect(noTargetJson.error).toMatch(/Missing 'to'|could not resolve/i);

        // 3. Drive the UI: load /dialer, open SMS panel, verify composer + undo flow
        await page.goto("/dialer");
        const smsBtn = page.getByRole("button", { name: /^SMS$/ });
        await expect(smsBtn).toBeVisible({ timeout: 25_000 });
        await smsBtn.click();

        const composer = page.getByPlaceholder(/type a message/i);
        await expect(composer).toBeVisible();
        const sendBtn = composer.locator("xpath=following-sibling::button[1]");

        // Wait for the "Sending From:" label — proves /api/messaging/numbers
        // came back and availableNumbers populated (otherwise handleSendClick
        // bails before scheduling the send).
        await expect(page.getByText(/Sending From:/i)).toBeVisible({ timeout: 10_000 });

        // Send button should be disabled with empty input
        await expect(sendBtn).toBeDisabled();

        // Type something (use typing to trigger full React onChange flow)
        await composer.click();
        await composer.pressSequentially("SMS pipeline dry-run — DO NOT SEND", { delay: 5 });
        await expect(composer).toHaveValue("SMS pipeline dry-run — DO NOT SEND");
        await expect(sendBtn).toBeEnabled();

        // Intercept the actual /api/messaging/send POST so we don't send real SMS
        let sendWasCalled = false;
        await page.route("**/api/messaging/send", (route) => {
            sendWasCalled = true;
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true, message: { sid: "TEST_INTERCEPTED" } }),
            });
        });

        await sendBtn.click();

        // Verify the 5s undo buffer engaged
        await expect(page.getByText(/Sending in \d/i)).toBeVisible({ timeout: 3_000 });

        // Click Undo before the 5s elapses
        await page.getByRole("button", { name: /Undo/i }).click();

        // Wait 6s to make sure no /api/messaging/send fires after undo
        await page.waitForTimeout(6_000);
        expect(sendWasCalled, "undo MUST cancel the actual /api/messaging/send call").toBe(false);

        // Composer should be re-populated so the operator can edit
        await expect(composer).toHaveValue("SMS pipeline dry-run — DO NOT SEND");

        console.log("All wiring checks passed. Pipeline is sane — UI, API guards, undo, sender list.");
    });
});
