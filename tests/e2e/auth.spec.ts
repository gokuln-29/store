import { expect, test, type Page } from "@playwright/test";

// Seeded by prisma/seed.ts (dev defaults).
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL || "owner@example.com";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || "ChangeMe@123";

async function adminLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("admin authentication", () => {
  test("signed-out visitors are sent to the admin login", async ({ page }) => {
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/admin\/login\?callbackUrl=%2Fen%2Fadmin$/);
    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  });

  test("owner can sign in and out", async ({ page }) => {
    await page.goto("/en/admin/login");
    await adminLogin(page, OWNER_EMAIL, OWNER_PASSWORD);

    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(page.getByTestId("admin-identity")).toContainText(OWNER_EMAIL);
    await expect(page.getByTestId("admin-identity")).toContainText("Owner");

    // Already signed in: the login page redirects to the dashboard.
    await page.goto("/en/admin/login");
    await expect(page).toHaveURL(/\/en\/admin$/);

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/admin\/login/);
  });

  test("wrong password shows an error and does not sign in", async ({ page }) => {
    await page.goto("/en/admin/login");
    await adminLogin(page, "nobody@example.com", "wrong-password");
    await expect(
      page.getByRole("alert").filter({ hasText: "Incorrect email or password." }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/admin\/login/);
  });

  test("shows validation errors in the page language", async ({ page }) => {
    await page.goto("/ta/admin/login");
    await page.getByRole("button", { name: "உள்நுழை" }).click();
    await expect(page.getByText("இந்தப் புலம் தேவை.").first()).toBeVisible();
  });
});

test.describe("customer area", () => {
  test("signed-out visitors are sent to the OTP login", async ({ page }) => {
    await page.goto("/en/account/addresses");
    await expect(page).toHaveURL(/\/en\/login\?callbackUrl=%2Fen%2Faccount%2Faddresses$/);
    await expect(page.getByRole("heading", { name: "Log in or sign up" })).toBeVisible();
  });

  test("rejects an invalid mobile number", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel("Mobile number").fill("12345");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("Enter a valid 10-digit mobile number.")).toBeVisible();
  });
});
