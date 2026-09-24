import { expect, test } from "@playwright/test";
import { cleanupCustomer, signInAsNewCustomer } from "./customer";

let customerId: string | undefined;
test.afterEach(() => {
  if (customerId) cleanupCustomer(customerId);
  customerId = undefined;
});

test("guest cart, then checkout with cash on delivery", async ({ page, context, baseURL }) => {
  await page.goto("/en/p/filter-coffee-powder");
  await page.getByRole("radio", { name: "250g" }).check({ force: true });
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /Cart, 1 item/ })).toBeVisible();

  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  await page.goto("/en/checkout");
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.getByText("Filter Coffee Powder")).toBeVisible();

  await page.getByLabel("Full name").fill("E2E Customer");
  await page.getByLabel("House / flat no., street").fill("1 Test Street");
  await page.getByLabel("City / town").fill("Bengaluru");
  await page.getByLabel("State").selectOption("KA");
  await page.getByLabel("Pincode").fill("560001");
  await page.getByText("Cash on delivery", { exact: true }).click();
  await expect(page.getByText("Cash on delivery fee")).toBeVisible();
  // 250g coffee ₹220 + ₹40 local delivery + ₹49 COD fee
  await expect(page.getByTestId("checkout-total")).toHaveText("₹309");

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/en\/order\/[A-Z0-9]+-\d+$/);
  await expect(
    page.getByRole("heading", { name: "Thank you! Your order is placed." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart", exact: true })).toBeVisible();
});

test("online payment through the test provider", async ({ page, context, baseURL }) => {
  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  await page.goto("/en/p/mysore-pak");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/en/checkout");
  await page.getByLabel("Full name").fill("E2E Customer");
  await page.getByLabel("House / flat no., street").fill("1 Test Street");
  await page.getByLabel("City / town").fill("Chennai");
  await page.getByLabel("State").selectOption("TN");
  await page.getByLabel("Pincode").fill("600020");
  await page.getByText("Pay online", { exact: true }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(/\/checkout\/pay\//);
  await page.getByRole("button", { name: "Simulate failure" }).click();
  await expect(page.getByText("The payment didn't go through. You can try again.")).toBeVisible();
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you! Your order is placed." }),
  ).toBeVisible();
});

test("the browser can't raise quantities above stock or set prices", async ({ page }) => {
  // Only ids and quantities live in the browser; prices always come from the server.
  await page.goto("/en/p/mango-pickle");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /Cart, 1 item/ })).toBeVisible();
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("cart-v1") ?? "{}");
    raw.state.items = raw.state.items.map((i: { variantId: string }) => ({
      ...i,
      quantity: 999,
      price: 1,
    }));
    localStorage.setItem("cart-v1", JSON.stringify(raw));
  });
  await page.goto("/en/cart");
  await expect(page.getByText(/Only \d+ left of one item/)).toBeVisible();
  await expect(page.getByText("₹189").first()).toBeVisible();
});
