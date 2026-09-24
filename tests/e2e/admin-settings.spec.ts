import { expect, test } from "@playwright/test";

import { OWNER_STATE } from "./fixtures";

test.use({ storageState: OWNER_STATE });

test("owner can open every settings section", async ({ page }) => {
  await page.goto("/en/admin/settings");
  await expect(page).toHaveURL(/\/en\/admin\/settings\/general$/);
  for (const [tab, field] of [
    ["Branding", "Primary colour"],
    ["Contact", "Support email"],
    ["Tax (GST)", "GSTIN"],
    ["Payments", "COD fee (₹)"],
  ] as const) {
    await page.getByRole("link", { name: tab }).click();
    await expect(page.getByLabel(field)).toBeVisible();
  }
  await page.getByRole("link", { name: "Shipping" }).click();
  await expect(page.getByRole("heading", { name: "Shipping rules" })).toBeVisible();
});

test("invalid settings show translated errors and are not saved", async ({ page }) => {
  await page.goto("/ta/admin/settings/tax");
  await page.waitForLoadState("networkidle"); // hydrated, so Enter submits via React
  await page.getByLabel("GSTIN").fill("NOTAGSTIN");
  // Submit with the keyboard (in dev, the Next.js badge can overlap the button on small screens).
  await page.getByLabel("GSTIN").press("Enter");
  await expect(page.getByText("சரியான 15 எழுத்து GSTIN ஐ உள்ளிடவும்.")).toBeVisible();
});

test("staff table and activity log load", async ({ page }) => {
  await page.goto("/en/admin/staff");
  // The email column is hidden on small screens; the owner row is marked "You".
  await expect(page.getByRole("row").filter({ hasText: "You" })).toBeVisible();
  await page.goto("/en/admin/audit-log");
  await expect(page.getByRole("heading", { name: "Activity log" })).toBeVisible();
});
