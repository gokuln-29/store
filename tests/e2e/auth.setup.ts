import { expect, test as setup } from "@playwright/test";

import { OWNER_STATE } from "./fixtures";

/** Logs the seeded owner in once; other tests reuse the session via storageState. */
setup("sign in as owner", async ({ page }) => {
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(process.env.SEED_OWNER_EMAIL || "owner@example.com");
  await page.getByLabel("Password").fill(process.env.SEED_OWNER_PASSWORD || "ChangeMe@123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/admin$/);
  await page.context().storageState({ path: OWNER_STATE });
});
