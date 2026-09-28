import { expect, test } from "@playwright/test";

// Relies on the demo seed (pnpm db:seed): categories, 12 products and a home page.

test("home page shows the configured sections", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Bestsellers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What our customers say" })).toBeVisible();
  const width = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(width).toBeLessThanOrEqual(0);
});

test("category filters are read from the URL", async ({ page }) => {
  await page.goto("/en/c/clothing?f.material=silk");
  await expect(page.getByText("1 product")).toBeVisible();
  await expect(page.getByRole("link", { name: /Kanchipuram Silk Saree/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Remove filter: Material: Silk/ })).toBeVisible();
});

test("sorting by price works", async ({ page }) => {
  await page.goto("/en/c/food?sort=price_asc");
  const names = await page.locator("main ul li :is(h2, h3)").allTextContents();
  expect(names[0]).toBe("Organic Turmeric Powder");
});

for (const [locale, name, addToCart] of [
  ["en", "Filter Coffee Powder", "Add to cart"],
  ["ta", "ஃபில்டர் காபி தூள்", "கூடையில் சேர்"],
  ["kn", "ಫಿಲ್ಟರ್ ಕಾಫಿ ಪುಡಿ", "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ"],
] as const) {
  test(`product page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/p/filter-coffee-powder`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("button", { name: addToCart })).toBeEnabled();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/${locale}/p/filter-coffee-powder$`),
    );
  });
}

test("variant choice updates price and SKU", async ({ page }) => {
  await page.goto("/en/p/filter-coffee-powder");
  await page.getByText("500g", { exact: true }).click();
  await expect(page.getByText("SKU: COFFEE-500G")).toBeVisible();
  await expect(page.getByText("₹420").first()).toBeVisible();
  await expect(page).toHaveURL(/variant=COFFEE-500G/);
});

test("delivery check uses shipping rules", async ({ page }) => {
  await page.goto("/en/p/filter-coffee-powder");
  await page.getByLabel("Pincode").fill("560001");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText(/Delivery in 1–3 days/)).toBeVisible();
});

test("search finds products in Tamil", async ({ page }) => {
  await page.goto("/ta/search?q=%E0%AE%AA%E0%AE%9F%E0%AF%8D%E0%AE%9F%E0%AF%81");
  await expect(page.getByRole("link", { name: /காஞ்சிபுரம் பட்டுப் புடவை/ })).toBeVisible();
});

test("unknown product returns 404", async ({ page }) => {
  const res = await page.goto("/en/p/does-not-exist");
  expect(res?.status()).toBe(404);
});

test("sitemap lists products in every language", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  for (const locale of ["en", "ta", "kn"])
    expect(xml).toContain(`/${locale}/p/filter-coffee-powder`);
  expect(xml).toContain('hreflang="ta"');
});
