import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the "Unknown Company" regression. The harness renders
 * displayCompanyName() against a lead whose stored companyName is a legacy
 * sentinel — the browser must show a real identifier (full name or phone
 * number), never the literal "Unknown Company"/"Unknown Caller"/etc.
 */

const SENTINELS = ["Unknown Company", "Unknown Caller", "Unknown Business", "Unknown"];

function harnessUrl(params: Record<string, string>): string {
    const sp = new URLSearchParams(params);
    return `/e2e-test/lead-display?${sp.toString()}`;
}

test.describe("displayCompanyName — never renders legacy sentinels", () => {
    for (const sentinel of SENTINELS) {
        test(`replaces "${sentinel}" with full name when name is present`, async ({ page }) => {
            await page.goto(harnessUrl({
                companyName: sentinel,
                firstName: "Jane",
                lastName: "Doe",
                phoneNumber: "+15551234567",
            }));

            const rendered = page.getByTestId("rendered-company");
            await expect(rendered).toHaveText("Jane Doe");
            for (const s of SENTINELS) {
                await expect(rendered).not.toHaveText(s);
            }
        });

        test(`replaces "${sentinel}" with phone number when no name available`, async ({ page }) => {
            await page.goto(harnessUrl({
                companyName: sentinel,
                phoneNumber: "+15551234567",
            }));

            const rendered = page.getByTestId("rendered-company");
            await expect(rendered).toHaveText("+15551234567");
        });
    }

    test("real company name is rendered as-is", async ({ page }) => {
        await page.goto(harnessUrl({
            companyName: "Acme Corporation",
            firstName: "Jane",
            lastName: "Doe",
            phoneNumber: "+15551234567",
        }));

        await expect(page.getByTestId("rendered-company")).toHaveText("Acme Corporation");
    });

    test("missing companyName falls back to full name", async ({ page }) => {
        await page.goto(harnessUrl({
            firstName: "Jane",
            lastName: "Doe",
            phoneNumber: "+15551234567",
        }));

        await expect(page.getByTestId("rendered-company")).toHaveText("Jane Doe");
    });
});
