import { expect, test } from "@playwright/test";

test("switching language is remembered for a year and used on the next visit", async ({
  page,
  context,
}) => {
  await page.goto("/en/p/mysore-pak");
  await page.getByRole("combobox", { name: "Language" }).selectOption("ta");
  await expect(page).toHaveURL(/\/ta\/p\/mysore-pak$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");

  const cookie = (await context.cookies()).find((c) => c.name === "NEXT_LOCALE");
  expect(cookie?.value).toBe("ta");
  const daysLeft = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
  expect(daysLeft).toBeGreaterThan(300);

  await page.goto("/");
  await expect(page).toHaveURL(/\/ta\/?$/);
});

test("validation errors appear in the page language", async ({ page }) => {
  await page.goto("/kn/login");
  await page.waitForLoadState("networkidle");
  const phone = page.getByRole("textbox").first();
  await phone.fill("12345");
  await phone.press("Enter");
  await expect(page.getByRole("alert").or(page.locator("[id$='-error']")).first()).toContainText(
    /[ಀ-೿]/,
  );
});
