import { test, expect } from "@playwright/test";

/**
 * Workstream D — Mocked Twilio Device e2e.
 *
 * Verifies that GlobalCallNotification correctly wires the React state
 * machine: incoming card renders, accept transitions to active overlay,
 * and the hang-up button calls disconnect() and clears state even when
 * the SDK never fires its 'disconnect' event.
 *
 * Loads a dev-only test harness page that exposes a window-level mock API
 * for driving Twilio Context state without the real SDK or auth.
 */

const HARNESS = "/e2e-test/call-notification";

test.describe("GlobalCallNotification — mocked Twilio Device", () => {
    test("incoming card appears, accept moves to active overlay, hangup clears UI", async ({ page }) => {
        await page.goto(HARNESS);
        await expect(page.getByTestId("harness-root")).toBeVisible();

        // Trigger incoming
        await page.evaluate(() => window.__E2E_TWILIO__!.simulateIncoming({
            callerName: "Test Caller",
            callerCompany: "Acme Co",
        }));

        await expect(page.getByText("Incoming Transmission").first()).toBeVisible();
        await expect(page.getByText("Test Caller")).toBeVisible();
        await expect(page.getByText("Acme Co")).toBeVisible();

        // Accept
        await page.getByRole("button", { name: /accept/i }).click();

        // Active overlay rendered
        await expect(page.getByText("On Air")).toBeVisible();

        // Hangup
        await page.locator('button:has(svg.lucide-phone-off)').last().click();

        // After hangup, neither overlay should remain visible
        await expect(page.getByText("On Air")).not.toBeVisible();
        await expect(page.getByText("Incoming Transmission")).not.toBeVisible();

        // Verify disconnect was called exactly once
        const state = await page.evaluate(() => window.__E2E_TWILIO__!.getState());
        expect(state.lastDisconnectCalled).toBe(1);
        expect(state.active).toBe(false);
    });

    test("hangup clears UI even if SDK never fires disconnect (defensive clear)", async ({ page }) => {
        await page.goto(HARNESS);

        // Directly inject an active call (skip the accept flow)
        await page.evaluate(() => window.__E2E_TWILIO__!.simulateActive());
        await expect(page.getByText("On Air")).toBeVisible();

        // The harness's mock connection's disconnect() does NOT cause the
        // SDK 'disconnect' event to fire — it only increments a counter.
        // The UI must clear from performHangup's eager state update alone.
        await page.locator('button:has(svg.lucide-phone-off)').last().click();
        await expect(page.getByText("On Air")).not.toBeVisible();

        const state = await page.evaluate(() => window.__E2E_TWILIO__!.getState());
        expect(state.active).toBe(false);
        expect(state.lastDisconnectCalled).toBe(1);
    });

    test("decline (reject) on incoming clears the card and calls reject() on the connection", async ({ page }) => {
        await page.goto(HARNESS);

        await page.evaluate(() => window.__E2E_TWILIO__!.simulateIncoming());
        await expect(page.getByText("Incoming Transmission").first()).toBeVisible();

        await page.getByRole("button", { name: /decline/i }).click();
        await expect(page.getByText("Incoming Transmission")).not.toBeVisible();

        const state = await page.evaluate(() => window.__E2E_TWILIO__!.getState());
        expect(state.incoming).toBe(false);
        expect(state.lastRejectCalled).toBe(1);
    });
});
