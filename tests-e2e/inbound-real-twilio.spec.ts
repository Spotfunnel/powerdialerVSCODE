import { test, expect } from "@playwright/test";

/**
 * Workstream E — Real Twilio Device e2e.
 *
 * Skipped by default. Set the env vars below to run. This test:
 *  1. Logs in as a real test agent
 *  2. Navigates to /dialer to trigger TwilioProvider's device.register()
 *  3. Uses Twilio's REST API to place a real `<Client>`-to-`<Client>` call
 *     to the test agent's identity (no PSTN, no per-minute charge)
 *  4. Asserts the incoming card renders and answer/hangup work
 *
 * Requires:
 *   E2E_USER_EMAIL          — login email of test agent
 *   E2E_USER_PASSWORD       — login password
 *   E2E_TEST_FROM_IDENTITY  — a Twilio Client identity allowed to place calls
 *   E2E_TWILIO_APP_SID      — TwiML app sid to dial through (must <Dial><Client> the agent's identity)
 *
 * The TWILIO_* credentials are read from the existing .env (Settings table).
 * No new credentials need to be provisioned.
 */

const REQUIRED = ["E2E_USER_EMAIL", "E2E_USER_PASSWORD", "E2E_TEST_FROM_IDENTITY"];
const HAVE_ENV = REQUIRED.every(k => !!process.env[k]);

test.describe("Inbound call — real Twilio Device", () => {
    test.skip(!HAVE_ENV, `Set ${REQUIRED.join(", ")} to run this test`);

    test("real <Client>-to-<Client> incoming triggers card; answer + hangup succeed", async ({ page }) => {
        // 1. Login
        await page.goto("/login");
        await page.fill('input[name="email"]', process.env.E2E_USER_EMAIL!);
        await page.fill('input[name="password"]', process.env.E2E_USER_PASSWORD!);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/(dialer|messaging|history|inbound|callbacks)/);

        // 2. Navigate to the dialer; TwilioProvider initialises here
        await page.goto("/dialer");

        // Wait for the device to register. We watch console logs for the
        // "[Twilio] Device registered" line that the provider emits.
        const registered = new Promise<void>((resolve) => {
            const handler = (msg: any) => {
                if (msg.text().includes("[Twilio]") && msg.text().toLowerCase().includes("registered")) {
                    page.off("console", handler);
                    resolve();
                }
            };
            page.on("console", handler);
        });
        await Promise.race([
            registered,
            new Promise((_, rej) => setTimeout(() => rej(new Error("Twilio Device did not register within 15s")), 15_000)),
        ]);

        // 3. Place an inbound call via REST API. The actual REST call lives
        //    in a helper because the credentials are encrypted in the DB and
        //    must be decrypted server-side; we hit our own /api/admin route
        //    that does the call placement.
        const placeRes = await page.request.post("/api/admin/e2e-place-call", {
            data: {
                to: `client:${process.env.E2E_USER_EMAIL}`,
                fromIdentity: process.env.E2E_TEST_FROM_IDENTITY,
                appSid: process.env.E2E_TWILIO_APP_SID,
            },
        });

        // If the helper route doesn't exist yet, surface a clear failure
        // explaining what's required.
        expect(placeRes.status(), `Need /api/admin/e2e-place-call to place test calls (returned ${placeRes.status()})`).toBe(200);

        // 4. Incoming card should appear within ~10s
        await expect(page.getByText("Incoming Transmission").first()).toBeVisible({ timeout: 15_000 });

        // 5. Answer
        await page.getByRole("button", { name: /accept/i }).click();
        await expect(page.getByText("On Air")).toBeVisible({ timeout: 5_000 });

        // 6. Hang up
        await page.locator('button:has(svg.lucide-phone-off)').last().click();
        await expect(page.getByText("On Air")).not.toBeVisible({ timeout: 5_000 });
    });
});
