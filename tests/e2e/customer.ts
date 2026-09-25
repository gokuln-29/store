import { execSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";

try {
  process.loadEnvFile();
} catch {
  // CI provides the environment.
}

function sql(statement: string) {
  execSync("pnpm exec prisma db execute --stdin", {
    input: statement,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

/**
 * Creates a customer and signs a real Auth.js session cookie for them (same secret as the
 * app), so checkout tests don't have to go through SMS OTP.
 */
export async function signInAsNewCustomer(context: BrowserContext, baseURL: string) {
  const id = `e2e_${randomBytes(6).toString("hex")}`;
  const phone = `+919${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
  sql(`INSERT INTO "User" (id, phone, name, role, "phoneVerifiedAt", "createdAt", "updatedAt")
       VALUES ('${id}', '${phone}', 'E2E Customer', 'CUSTOMER', now(), now(), now());`);

  const { encode } = await import("next-auth/jwt");
  const now = Date.now();
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for e2e tests");
  const cookieName = "authjs.session-token";
  const value = await encode({
    token: { sub: id, role: "CUSTOMER", sv: 0, loginAt: now, checkedAt: now },
    secret,
    salt: cookieName,
    maxAge: 60 * 60,
  });
  await context.addCookies([
    { name: cookieName, value, url: baseURL, httpOnly: true, sameSite: "Lax" },
  ]);
  return { id, phone };
}

/** Puts back stock taken by the customer's orders, then removes their orders and account. */
export function cleanupCustomer(id: string) {
  sql(`
    UPDATE "ProductVariant" v SET stock = v.stock + oi.qty
    FROM (SELECT oi."variantId", SUM(oi.quantity) AS qty FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE o."userId" = '${id}' AND o.status <> 'CANCELLED' -- cancelled orders already released stock
          GROUP BY oi."variantId") oi
    WHERE v.id = oi."variantId";
    UPDATE "Coupon" c SET "usedCount" = GREATEST(0, c."usedCount" - u.n)
    FROM (SELECT "couponId", COUNT(*) AS n FROM "CouponUsage" WHERE "userId" = '${id}' GROUP BY "couponId") u
    WHERE c.id = u."couponId";
    DELETE FROM "AuditLog" WHERE "entityType" = 'Payment' AND "entityId" IN (
      SELECT p.id FROM "Payment" p JOIN "Order" o ON o.id = p."orderId" WHERE o."userId" = '${id}');
    DELETE FROM "Notification" WHERE "userId" = '${id}'
      OR "orderId" IN (SELECT o.id FROM "Order" o WHERE o."userId" = '${id}');
    DELETE FROM "Order" WHERE "userId" = '${id}';
    DELETE FROM "User" WHERE id = '${id}';`);
}

/** Checks out one "Mysore Pak" with cash on delivery; returns the order number. */
export async function placeCodOrder(page: Page): Promise<string> {
  await page.goto("/en/p/mysore-pak");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/en/checkout");
  await page.getByLabel("Full name").fill("E2E Orders");
  await page.getByLabel("House / flat no., street").fill("1 Test Street");
  await page.getByLabel("City / town").fill("Chennai");
  await page.getByLabel("State").selectOption("TN");
  await page.getByLabel("Pincode").fill("600020");
  await page.getByText("Cash on delivery", { exact: true }).click();
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/\/en\/order\/[A-Z0-9]+-\d+$/);
  return decodeURIComponent(page.url().split("/").pop()!);
}
