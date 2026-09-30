import { expect, test } from "@playwright/test";
import { cleanupCustomer, signInAsNewCustomer } from "./customer";
import { OWNER_STATE } from "./fixtures";

let customerId: string | undefined;
test.afterEach(() => {
  if (customerId) cleanupCustomer(customerId);
  customerId = undefined;
});

/** The whole path a real order takes: browse → cart → checkout (COD) → staff fulfil → delivered. */
test("browse, buy with cash on delivery, and the store fulfils the order", async ({
  page,
  context,
  baseURL,
  browser,
}) => {
  customerId = (await signInAsNewCustomer(context, baseURL!)).id;

  // Browse: search, then a category, then the product.
  await page.goto("/en/search?q=mysore");
  await expect(page.getByRole("link", { name: /Mysore Pak/ }).first()).toBeVisible();
  await page.goto("/en/c/food");
  await page
    .getByRole("link", { name: /Mysore Pak/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Mysore Pak" })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /Cart, 1 item/ })).toBeVisible();

  // Checkout with cash on delivery.
  await page.goto("/en/cart");
  await page.getByRole("link", { name: "Checkout" }).click();
  await page.getByLabel("Full name").fill("Journey Test");
  await page.getByLabel("House / flat no., street").fill("1 Test Street");
  await page.getByLabel("City / town").fill("Bengaluru");
  await page.getByLabel("State").selectOption("KA");
  await page.getByLabel("Pincode").fill("560001");
  await page
    .getByRole("radiogroup", { name: "Payment" })
    .getByText("Cash on delivery", { exact: true })
    .click();
  await expect(page.getByTestId("checkout-total")).toHaveText(/₹\d/);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/en\/order\/[A-Z0-9]+-\d+$/);
  const orderNumber = decodeURIComponent(page.url().split("/").pop()!);

  // The store fulfils it.
  const staff = await browser.newContext({ storageState: OWNER_STATE });
  const admin = await staff.newPage();
  await admin.goto(`/en/admin/orders?q=${encodeURIComponent(orderNumber)}`);
  await admin.getByRole("link", { name: new RegExp(orderNumber) }).click();
  for (const action of ["Confirm order", "Mark as packed"]) {
    await admin.getByRole("button", { name: action }).click();
    await admin.getByRole("dialog").getByRole("button", { name: action }).click();
    await expect(admin.getByRole("dialog")).toBeHidden();
  }
  await admin.getByRole("button", { name: "Mark as shipped" }).click();
  await admin.getByRole("dialog").getByLabel("Tracking number").fill("JOURNEY-1");
  await admin.getByRole("dialog").getByRole("button", { name: "Mark as shipped" }).click();
  await expect(admin.getByRole("dialog")).toBeHidden();
  await admin.getByRole("button", { name: "Mark as delivered" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Mark as delivered" }).click();
  await expect(admin.getByText("Delivered", { exact: true }).first()).toBeVisible();
  await staff.close();

  // The customer sees it delivered and can download the invoice.
  await page.goto(`/en/account/orders/${orderNumber}`);
  await expect(page.getByText("Delivered", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("JOURNEY-1")).toBeVisible();
  const invoice = await page.request.get(`/api/orders/${encodeURIComponent(orderNumber)}/invoice`);
  expect(invoice.headers()["content-type"]).toBe("application/pdf");
});

/**
 * Razorpay test mode: runs only when the server uses Razorpay with test keys
 * (PAYMENT_PROVIDER=razorpay, RAZORPAY_KEY_ID=rzp_test_…). Checks that checkout opens
 * Razorpay's payment window for the right order; finishing the payment inside Razorpay's
 * window is a manual step (see docs/payments.md).
 */
test("online payment opens Razorpay test checkout", async ({ page, context, baseURL }) => {
  test.skip(
    process.env.PAYMENT_PROVIDER !== "razorpay" ||
      !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"),
    "Razorpay test keys not configured",
  );
  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  await page.goto("/en/p/mysore-pak");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/en/checkout");
  await page.getByLabel("Full name").fill("Razorpay Test");
  await page.getByLabel("House / flat no., street").fill("1 Test Street");
  await page.getByLabel("City / town").fill("Chennai");
  await page.getByLabel("State").selectOption("TN");
  await page.getByLabel("Pincode").fill("600020");
  await page.getByText("Pay online", { exact: true }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//);
  await expect(page.locator("iframe.razorpay-checkout-frame")).toBeVisible({ timeout: 20_000 });
});
