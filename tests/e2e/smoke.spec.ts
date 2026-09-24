import { expect, test } from "@playwright/test";

// A heading from the seeded home page, translated per language.
const locales = [
  { locale: "en", heading: "Bestsellers" },
  { locale: "ta", heading: "அதிகம் விற்பனையானவை" },
  { locale: "kn", heading: "ಹೆಚ್ಚು ಮಾರಾಟವಾದವು" },
];

for (const { locale, heading } of locales) {
  test(`home page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  });
}

test("root redirects to a locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(en|ta|kn)$/);
});

test("unknown page shows localized 404", async ({ page }) => {
  const response = await page.goto("/en/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

// Requires the database to be running (`pnpm db:up`).
test("health check reports app and database OK", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok", db: "ok" });
});
