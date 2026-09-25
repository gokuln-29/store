import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./fixtures";

test.use({ storageState: OWNER_STATE });

test("owners compose push campaigns with a live preview", async ({ page }) => {
  await page.goto("/en/admin/push");
  await expect(page.getByRole("heading", { name: "Push campaigns" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: /Title/ }).first().fill("Diwali sale");
  await page
    .getByRole("textbox", { name: /Message/ })
    .first()
    .fill("20% off all sweets this week");
  const preview = page.getByRole("complementary", { name: "Preview" });
  await expect(preview.getByText("Diwali sale")).toBeVisible();
  await expect(preview.getByText("20% off all sweets this week")).toBeVisible();
  // With no opted-in devices there is nobody to send to.
  const audience = await page
    .getByText(/opted in to offers/)
    .first()
    .textContent();
  if (audience?.startsWith("No devices")) {
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  }
});
