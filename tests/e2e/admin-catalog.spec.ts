import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./fixtures";

test.use({ storageState: OWNER_STATE });

/** Removes a product created by a test (tests run in parallel, so each cleans up its own). */
function deleteProduct(slug: string) {
  execSync("pnpm exec prisma db execute --stdin", {
    input: `DELETE FROM "Product" WHERE slug = '${slug.replace(/'/g, "")}';`,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

test("owner creates a product with variants", async ({ page }, testInfo) => {
  const slug = `e2e-${testInfo.project.name}-${Date.now()}`;
  const sku = slug.toUpperCase();
  // Clean up even if an assertion fails.
  test.info().annotations.push({ type: "cleanup", description: slug });

  await page.goto("/en/admin/products/new");
  await page.locator("#field-name-en").fill("E2E Filter Coffee");
  await page.getByLabel("Category").selectOption({ label: "Food" });
  await page.getByLabel("Diet type *").selectOption("veg");
  await page.getByLabel("Shelf life (days) *").fill("90");
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByLabel("URL slug").fill(slug);

  await page.getByRole("button", { name: "Add option" }).click();
  await page.locator("#option-0-en").fill("Pack size");
  await page.getByLabel("Add value").fill("250g, 500g");
  await page.getByLabel("Add value").press("Enter");
  await expect(page.locator('input[name$=".sku"]')).toHaveCount(2);

  const skus = page.locator('input[name$=".sku"]');
  await skus.nth(0).fill(`${sku}-250`);
  await skus.nth(1).fill(`${sku}-500`);
  await page.locator('input[name="variants.0.price"]').fill("220");
  await page.locator('input[name="variants.1.price"]').fill("420");
  await page.locator('input[name="variants.0.stock"]').fill("10");

  // Submit via keyboard: the dev-tools badge can overlap buttons on small screens.
  await page.getByLabel("URL slug").press("Enter");
  await expect(page).toHaveURL(/\/en\/admin\/products\/c[a-z0-9]+$/);
  await expect(page.getByText("Product saved").first()).toBeVisible();

  await page.goto(`/en/admin/products?q=${slug}`);
  const row = page.getByRole("row").filter({ hasText: "E2E Filter Coffee" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Published")).toBeVisible();
  await expect(row.getByText("2 variants")).toBeVisible();
});

test.afterEach(({}, testInfo) => {
  for (const a of testInfo.annotations)
    if (a.type === "cleanup" && a.description) deleteProduct(a.description);
});

test("category fields are required when marked so", async ({ page }) => {
  await page.goto("/en/admin/products/new");
  await page.locator("#field-name-en").fill("E2E Incomplete");
  await page.getByLabel("Category").selectOption({ label: "Food" });
  await page.locator('input[name="variants.0.sku"]').fill(`E2E-INCOMPLETE-${Date.now()}`);
  await page.locator('input[name="variants.0.price"]').fill("100");
  await page.locator("#field-name-en").press("Enter");
  await expect(page.getByText("This field is required.").first()).toBeVisible();
  await expect(page).toHaveURL(/\/products\/new$/);
});
