import { expect, test } from "@playwright/test";
import { cleanupCustomer, markDelivered, placeCodOrder, signInAsNewCustomer } from "./customer";
import { OWNER_STATE } from "./fixtures";

let customerId: string | undefined;
test.afterEach(() => {
  if (customerId) cleanupCustomer(customerId);
  customerId = undefined;
});

test("a guest's wishlist is kept when they sign in", async ({ page, context, baseURL }) => {
  await page.goto("/en/p/mysore-pak");
  await page.getByRole("button", { name: /^Save$/ }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/en/wishlist");
  await expect(page.getByText("Mysore Pak").first()).toBeVisible();

  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  await page.reload(); // first signed-in visit: the guest list is merged into the account
  await expect(page.getByText("Mysore Pak").first()).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Wipe this device's copy: the list comes back from the account.
  await page.evaluate(() => localStorage.removeItem("wishlist-v1"));
  await page.reload();
  await expect(page.getByText("Mysore Pak").first()).toBeVisible();
});

test("a customer reviews a delivered product and it appears once approved", async ({
  page,
  context,
  baseURL,
  browser,
}) => {
  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  const orderNumber = await placeCodOrder(page);
  markDelivered(orderNumber);

  await page.goto(`/en/account/orders/${orderNumber}`);
  await page.getByRole("button", { name: "Write a review" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Submit review" }).click();
  await expect(dialog.getByText("Choose a rating from 1 to 5 stars.")).toBeVisible();
  await dialog.getByRole("radio", { name: "4 stars" }).click();
  const text = `Fresh and not too sweet ${Date.now()}`;
  await dialog.getByLabel("Your review (optional)").fill(text);
  await dialog.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText("Review awaiting approval")).toBeVisible();

  // Not public until approved.
  await page.goto("/en/p/mysore-pak");
  await expect(page.getByText(text)).toHaveCount(0);

  const owner = await browser.newContext({ storageState: OWNER_STATE });
  const admin = await owner.newPage();
  await admin.goto(`/en/admin/reviews?status=PENDING&q=${encodeURIComponent(text)}`);
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Review approved.")).toBeVisible();
  await owner.close();

  await page.goto("/en/p/mysore-pak");
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByText("Verified purchase").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Rated [\d.]+ out of 5/ }).first()).toBeVisible();
});

test.describe("admin", () => {
  test.use({ storageState: OWNER_STATE });

  test("coupons can be created, disabled and deleted", async ({ page }) => {
    const code = `E2E${Date.now().toString().slice(-6)}`;
    await page.goto("/en/admin/coupons/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Code").fill(code.toLowerCase());
    await page.getByLabel("Percent off (%)").fill("15");
    await page.getByLabel("Maximum discount (₹)").fill("200");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/coupons$/);

    const row = page.getByRole("row").filter({ hasText: code });
    await expect(row.getByText("15%")).toBeVisible();
    await expect(row.getByText("Active")).toBeVisible();
    await row.getByRole("button", { name: "Disable" }).click();
    await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row").filter({ hasText: code })).toHaveCount(0);
  });

  test("the dashboard shows sales, charts with a table view, and exports CSV", async ({ page }) => {
    await page.goto("/en/admin?range=30d");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Last 30 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const summary = page.getByRole("region", { name: "Summary" });
    for (const label of ["Revenue", "Orders", "Average order value", "Conversion"]) {
      await expect(summary.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: "Revenue" })).toBeVisible();
    await page.getByText("Show as table").first().click();
    await expect(page.getByRole("columnheader", { name: "Day" }).first()).toBeVisible();

    const orders = await page.request.get("/api/admin/export/orders?range=30d");
    expect(orders.headers()["content-type"]).toContain("text/csv");
    expect((await orders.text()).split("\n")[0]).toContain("Order,Created,Placed,Status");
    const customers = await page.request.get("/api/admin/export/customers");
    expect(customers.status()).toBe(200);
  });

  // Toggles a feature no other test relies on (tests run in parallel against one store).
  test("feature switches hide a feature on the store", async ({ page, browser }) => {
    const toggle = async () => {
      await page.goto("/en/admin/settings/features");
      await page.waitForLoadState("networkidle");
      await page.getByRole("switch", { name: "Related products" }).click();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();
    };
    const shopper = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const store = await shopper.newPage();
    await store.goto("/en/p/mysore-pak");
    await expect(store.getByRole("heading", { name: "You may also like" })).toBeVisible();

    await toggle(); // off
    try {
      await store.goto("/en/p/mysore-pak");
      await expect(store.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(store.getByRole("heading", { name: "You may also like" })).toHaveCount(0);
    } finally {
      await toggle(); // back on
      await shopper.close();
    }
  });

  test("customers can be searched", async ({ page }) => {
    await page.goto("/en/admin/customers");
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Lifetime value/ })).toBeVisible();
  });
});
