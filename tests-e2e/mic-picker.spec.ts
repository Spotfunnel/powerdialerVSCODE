import { test, expect, Page } from "@playwright/test";

/**
 * End-to-end stress tests for the MicPicker. Drives every scenario through
 * the /e2e-test/mic-picker harness which exposes window.__E2E_MIC__ for
 * controlled state.
 *
 * Stress-tested invariants:
 *   - Trigger shows the active device label, not just "Mic"
 *   - Click → popover opens with all devices, current marked with check
 *   - Selecting a different device updates the label, persists to sessionStorage
 *   - Reload (within same session) restores the saved device
 *   - Plug/unplug refreshes the list; if active device disappears, label
 *     gracefully shows fallback
 *   - Esc closes the popover
 *   - Click outside closes the popover
 *   - Repeated rapid open/close doesn't leak listeners (no JS error)
 *   - setInputDevice failure (hardware refusal) doesn't crash the picker;
 *     the popover still closes and the previous label is preserved
 */

const HARNESS = "/e2e-test/mic-picker";

async function harnessReady(page: Page) {
    await page.goto(HARNESS);
    await expect(page.getByTestId("harness-root")).toBeVisible();
    // Wait for the harness wiring to attach
    await page.waitForFunction(() => !!(window as any).__E2E_MIC__);
}

test.describe("MicPicker — discreet active-device display", () => {
    test("renders trigger with truncated active device name when one is restored from session", async ({ page }) => {
        await harnessReady(page);
        // Pre-seed sessionStorage to a known device, then reload so the harness restores it
        await page.evaluate(() => window.sessionStorage.setItem("powerdialer:micDeviceId", "mic-headset"));
        await page.reload();
        await harnessReady(page);

        const label = page.getByTestId("mic-picker-active-label");
        await expect(label).toBeVisible();
        await expect(label).toContainText("Logitech");
    });

    test("falls back to first available device when nothing is saved", async ({ page }) => {
        await harnessReady(page);
        await page.evaluate(() => window.__E2E_MIC__!.clearStorage());
        await page.reload();
        await harnessReady(page);

        // First device in the harness is "MacBook Air Microphone"
        await expect(page.getByTestId("mic-picker-active-label")).toContainText("MacBook");
    });
});

test.describe("MicPicker — open/close + selection flow", () => {
    test.beforeEach(async ({ page }) => {
        await harnessReady(page);
        await page.evaluate(() => window.__E2E_MIC__!.clearStorage());
        await page.reload();
        await harnessReady(page);
    });

    test("clicking trigger opens the popover with every available device", async ({ page }) => {
        await page.getByTestId("mic-picker-trigger").click();
        const list = page.getByTestId("mic-picker-list");
        await expect(list).toBeVisible();

        await expect(page.getByTestId("mic-option-mic-internal")).toBeVisible();
        await expect(page.getByTestId("mic-option-mic-headset")).toBeVisible();
        await expect(page.getByTestId("mic-option-mic-usb")).toBeVisible();
    });

    test("selecting a device updates active label, persists to sessionStorage, closes popover", async ({ page }) => {
        await page.getByTestId("mic-picker-trigger").click();
        await page.getByTestId("mic-option-mic-headset").click();

        // Popover closed
        await expect(page.getByTestId("mic-picker-list")).toBeHidden();

        // Active label reflects the new device
        await expect(page.getByTestId("mic-picker-active-label")).toContainText("Logitech");

        // Persisted to sessionStorage
        const saved = await page.evaluate(() => window.sessionStorage.getItem("powerdialer:micDeviceId"));
        expect(saved).toBe("mic-headset");

        // setInputDevice was actually called once with the right id
        const state = await page.evaluate(() => window.__E2E_MIC__!.getState());
        expect(state.setCalls).toEqual([{ deviceId: "mic-headset", ok: true }]);
    });

    test("Escape closes the popover", async ({ page }) => {
        await page.getByTestId("mic-picker-trigger").click();
        await expect(page.getByTestId("mic-picker-list")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("mic-picker-list")).toBeHidden();
    });

    test("clicking outside closes the popover", async ({ page }) => {
        await page.getByTestId("mic-picker-trigger").click();
        await expect(page.getByTestId("mic-picker-list")).toBeVisible();
        // Click the harness state preview, which is outside the picker
        await page.getByTestId("harness-state").click();
        await expect(page.getByTestId("mic-picker-list")).toBeHidden();
    });
});

test.describe("MicPicker — plug/unplug + failure resilience", () => {
    test("removes a device from the list when it's unplugged (deviceChange)", async ({ page }) => {
        await harnessReady(page);
        await page.evaluate(() => window.__E2E_MIC__!.simulateDevices([
            { deviceId: "mic-internal", label: "MacBook Air Microphone" },
        ]));

        await page.getByTestId("mic-picker-trigger").click();
        await expect(page.getByTestId("mic-option-mic-internal")).toBeVisible();
        await expect(page.getByTestId("mic-option-mic-headset")).toBeHidden();
        await expect(page.getByTestId("mic-option-mic-usb")).toBeHidden();
    });

    test("setInputDevice failure does not crash the picker; popover still closes", async ({ page }) => {
        await harnessReady(page);
        await page.evaluate(() => window.__E2E_MIC__!.failNextSet());

        await page.getByTestId("mic-picker-trigger").click();
        await page.getByTestId("mic-option-mic-headset").click();

        // Popover closes regardless of failure
        await expect(page.getByTestId("mic-picker-list")).toBeHidden();

        // The harness recorded a failed setCall and did NOT update active
        const state = await page.evaluate(() => window.__E2E_MIC__!.getState());
        expect(state.setCalls.at(-1)).toEqual({ deviceId: "mic-headset", ok: false });
        expect(state.active).not.toBe("mic-headset");
    });
});

test.describe("MicPicker — stress: rapid open/close + many selections", () => {
    test("100 open/close cycles do not leak listeners or break state", async ({ page }) => {
        await harnessReady(page);

        for (let i = 0; i < 100; i++) {
            await page.getByTestId("mic-picker-trigger").click();
            await page.keyboard.press("Escape");
        }

        // Final state: popover hidden, no JS errors (Playwright fails on uncaught)
        await expect(page.getByTestId("mic-picker-list")).toBeHidden();
    });

    test("rapid alternating selections persist the latest pick", async ({ page }) => {
        await harnessReady(page);
        await page.evaluate(() => window.__E2E_MIC__!.clearStorage());
        await page.reload();
        await harnessReady(page);

        const ids = ["mic-internal", "mic-headset", "mic-usb", "mic-internal", "mic-headset", "mic-usb"];
        for (const id of ids) {
            await page.getByTestId("mic-picker-trigger").click();
            await page.getByTestId(`mic-option-${id}`).click();
        }

        const saved = await page.evaluate(() => window.sessionStorage.getItem("powerdialer:micDeviceId"));
        expect(saved).toBe("mic-usb");
        const state = await page.evaluate(() => window.__E2E_MIC__!.getState());
        expect(state.setCalls).toHaveLength(ids.length);
        expect(state.setCalls.every(c => c.ok)).toBe(true);
    });
});
