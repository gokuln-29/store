import { expect, test } from "@playwright/test";
import { cleanupCustomer, placeCodOrder, signInAsNewCustomer } from "./customer";
import { OWNER_STATE } from "./fixtures";

test.use({ storageState: OWNER_STATE });

let customerId: string | undefined;
test.afterEach(() => {
  if (customerId) cleanupCustomer(customerId);
  customerId = undefined;
});

test("staff confirm, pack and ship an order, then download its invoice", async ({
  page,
  browser,
  baseURL,
}) => {
  const shopper = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  customerId = (await signInAsNewCustomer(shopper, baseURL!)).id;
  const orderNumber = await placeCodOrder(await shopper.newPage());
  await shopper.close();

  await page.goto(`/en/admin/orders?q=${encodeURIComponent(orderNumber)}`);
  await page.getByRole("link", { name: new RegExp(orderNumber) }).click();
  await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
  // No invoice before shipping.
  await expect(page.getByRole("link", { name: "Invoice (PDF)" })).toHaveCount(0);

  for (const action of ["Confirm order", "Mark as packed"]) {
    await page.getByRole("button", { name: action }).click();
    await page.getByRole("dialog").getByRole("button", { name: action }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }

  await page.getByRole("button", { name: "Mark as shipped" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Courier").fill("Delhivery");
  await dialog.getByLabel("Tracking number").fill("E2E-TRACK-1");
  await dialog.getByLabel("Tracking link").fill("not a url");
  await dialog.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(dialog.getByText("Enter a full link starting with https://")).toBeVisible();
  await dialog.getByLabel("Tracking link").fill("https://track.example/E2E-TRACK-1");
  await dialog.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Shipped", { exact: true }).first()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Invoice (PDF)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^invoice-[A-Z0-9]+-\d{4,}\.pdf$/);
  const response = await page.request.get(`/api/orders/${encodeURIComponent(orderNumber)}/invoice`);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const slip = await page.request.get(
    `/api/admin/orders/${encodeURIComponent(orderNumber)}/packing-slip`,
  );
  expect(slip.status()).toBe(200);

  await page.getByLabel("Add a note").fill("Gift wrap requested by phone");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Gift wrap requested by phone")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as delivered" })).toBeVisible();
});

test("documents are not available to signed-out visitors", async ({ browser }) => {
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await anon.request.get("/api/orders/DS-1001/invoice");
  expect(res.status()).toBe(401);
  const slip = await anon.request.get("/api/admin/orders/DS-1001/packing-slip");
  expect(slip.status()).toBe(403);
  await anon.close();
});
