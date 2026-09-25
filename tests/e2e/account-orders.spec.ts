import { expect, test } from "@playwright/test";
import { cleanupCustomer, placeCodOrder, signInAsNewCustomer } from "./customer";

let customerId: string | undefined;
test.afterEach(() => {
  if (customerId) cleanupCustomer(customerId);
  customerId = undefined;
});

test("a customer sees their order, cancels it and buys again", async ({
  page,
  context,
  baseURL,
}) => {
  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  const orderNumber = await placeCodOrder(page);

  await page.getByRole("link", { name: "View order details" }).click();
  await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
  await expect(page.getByText("Your invoice will be ready when the order ships.")).toBeVisible();

  await page.goto("/en/account/orders");
  await expect(page.getByRole("link", { name: new RegExp(orderNumber) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(orderNumber) }).click();

  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByLabel("Reason (optional)").fill("Ordered by mistake");
  await page.getByRole("button", { name: "Yes, cancel order" }).click();
  await expect(page.getByText("Your order has been cancelled.").first()).toBeVisible();
  await expect(page.getByText(/Reason: Ordered by mistake/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

  await page.getByRole("button", { name: "Buy again" }).click();
  await expect(page).toHaveURL(/\/en\/cart$/);
  await expect(page.getByText("Mysore Pak").first()).toBeVisible();
});

test("the orders page shows an empty state for new customers", async ({
  page,
  context,
  baseURL,
}) => {
  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  await page.goto("/en/account/orders");
  await expect(page.getByText("You haven't placed any orders yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start shopping" })).toBeVisible();
});
