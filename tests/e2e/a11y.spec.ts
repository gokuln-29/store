import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanupCustomer, placeCodOrder, signInAsNewCustomer } from "./customer";
import { OWNER_STATE } from "./fixtures";

/**
 * Automated accessibility audit (axe-core, WCAG 2.1 A/AA). Fails on serious or critical
 * violations; minor/moderate ones are reported in the test output.
 */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The Next.js dev-tools badge isn't part of the site.
    .exclude("nextjs-portal")
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const minor = results.violations.filter((v) => !blocking.includes(v));
  if (minor.length) console.log(`[a11y] ${label}: minor → ${minor.map((v) => v.id).join(", ")}`);
  expect(
    blocking.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    ),
    label,
  ).toEqual([]);
}

test.describe("storefront", () => {
  for (const locale of ["en", "ta", "kn"]) {
    test(`home, category, product and search in ${locale}`, async ({ page }) => {
      for (const path of ["", "/c/food", "/p/mysore-pak", "/search?q=coffee", "/wishlist"]) {
        await page.goto(`/${locale}${path}`);
        await page.waitForLoadState("networkidle");
        await audit(page, `${locale}${path || "/"}`);
      }
    });
  }

  test("login page", async ({ page }) => {
    await page.goto("/en/login");
    await audit(page, "login");
  });
});

test.describe("customer", () => {
  let customerId: string | undefined;
  test.afterEach(() => {
    if (customerId) cleanupCustomer(customerId);
    customerId = undefined;
  });

  test("cart, checkout, confirmation and account", async ({ page, context, baseURL }) => {
    customerId = (await signInAsNewCustomer(context, baseURL!)).id;
    await page.goto("/en/p/mysore-pak");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.goto("/en/cart");
    await page.waitForLoadState("networkidle");
    await audit(page, "cart");
    await page.goto("/en/checkout");
    await page.waitForLoadState("networkidle");
    await audit(page, "checkout");
    await page.goto("/en/cart");
    const orderNumber = await placeCodOrder(page);
    await audit(page, "order confirmation");
    for (const path of [
      "/en/account",
      "/en/account/orders",
      `/en/account/orders/${orderNumber}`,
      "/en/account/addresses",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await audit(page, path);
    }
  });
});

test.describe("admin", () => {
  test.use({ storageState: OWNER_STATE });
  test("dashboard and main lists", async ({ page }) => {
    for (const path of [
      "/en/admin",
      "/en/admin/products",
      "/en/admin/orders",
      "/en/admin/customers",
      "/en/admin/coupons/new",
      "/en/admin/settings/features",
      "/ta/admin/reviews",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await audit(page, path);
    }
  });
});
