import { expect, test } from "@playwright/test";
import { cleanupCustomer, signInAsNewCustomer } from "./customer";
import { OWNER_STATE } from "./fixtures";

test.use({ storageState: OWNER_STATE });

let customerId: string | undefined;
test.afterEach(() => {
  if (customerId) cleanupCustomer(customerId);
  customerId = undefined;
});

test("owner refunds part of an online payment", async ({ page, browser, baseURL }) => {
  // A customer pays online (test provider) in their own browser.
  const shopper = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  customerId = (await signInAsNewCustomer(shopper, baseURL!)).id;
  const store = await shopper.newPage();
  await store.goto("/en/p/mysore-pak");
  await store.getByRole("button", { name: "Add to cart" }).click();
  await store.goto("/en/checkout");
  await store.getByLabel("Full name").fill("E2E Refund");
  await store.getByLabel("House / flat no., street").fill("1 Test Street");
  await store.getByLabel("City / town").fill("Chennai");
  await store.getByLabel("State").selectOption("TN");
  await store.getByLabel("Pincode").fill("600020");
  await store.getByText("Pay online", { exact: true }).click();
  await store.getByRole("button", { name: "Continue to payment" }).click();
  await store.getByRole("button", { name: /^Pay ₹/ }).click();
  await expect(store).toHaveURL(/\/en\/order\/[A-Z0-9]+-\d+$/);
  const orderNumber = decodeURIComponent(store.url().split("/").pop()!);
  await shopper.close();

  // The owner finds the payment and refunds ₹10 of it.
  await page.goto(`/en/admin/payments?q=${encodeURIComponent(orderNumber)}`);
  await page.getByRole("link", { name: new RegExp(orderNumber) }).click();
  await expect(page.getByRole("heading", { name: `Payment for ${orderNumber}` })).toBeVisible();
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();

  await page.getByLabel("Amount to refund (₹)").fill("10");
  await page.getByLabel("Reason (optional)").fill("Late delivery");
  await page.getByRole("button", { name: "Refund…" }).click();
  await page.getByRole("button", { name: "Refund ₹10" }).click();
  await expect(page.getByText("Refund completed.")).toBeVisible();
  await expect(page.getByText("Partly refunded", { exact: true })).toBeVisible();
  await expect(page.getByText("Late delivery")).toBeVisible();

  // Asking for more than what's left is refused before anything is sent.
  const remaining = await page.getByLabel("Amount to refund (₹)").inputValue();
  await page
    .getByLabel("Amount to refund (₹)")
    .fill(String(Number(remaining.replace(/,/g, "")) + 1));
  await page.getByRole("button", { name: "Refund…" }).click();
  await expect(page.getByText(/more than what can be refunded/)).toBeVisible();
});

test("webhook endpoint rejects unsigned requests", async ({ request }) => {
  const res = await request.post("/api/webhooks/razorpay", {
    data: { event: "payment.captured", payload: {} },
    headers: { "x-razorpay-signature": "0".repeat(64) },
  });
  expect(res.status()).toBe(401);
});

test("cron endpoint requires the secret", async ({ request }) => {
  const res = await request.get("/api/cron/expire-orders");
  expect([401, 503]).toContain(res.status());
});
