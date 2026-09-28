import { expect, test } from "@playwright/test";
import { cleanupCustomer, signInAsNewCustomer } from "./customer";

let customerId: string | undefined;
test.afterEach(() => {
  if (customerId) cleanupCustomer(customerId);
});

// Regression: an unstable callback in the re-quote effect once made checkout request a new
// quote from the server in an endless loop.
test("an idle checkout page stops asking the server for quotes", async ({
  page,
  context,
  baseURL,
}) => {
  customerId = (await signInAsNewCustomer(context, baseURL!)).id;
  await page.goto("/en/p/mysore-pak");
  await page.getByRole("button", { name: "Add to cart" }).click();
  let actions = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) actions += 1;
  });
  await page.goto("/en/checkout");
  await expect(page.getByTestId("checkout-total")).toBeVisible();
  await page.waitForTimeout(2500);
  const settled = actions;
  await page.waitForTimeout(2500);
  expect(actions - settled).toBe(0);
  // A handful of start-up requests (saved cart, quote, addresses) is fine; a loop sends hundreds.
  expect(settled).toBeLessThan(10);
});
