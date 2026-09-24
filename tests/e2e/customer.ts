import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

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
  const phone = `+919${String(Date.now()).slice(-9)}`;
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
          JOIN "Order" o ON o.id = oi."orderId" WHERE o."userId" = '${id}' GROUP BY oi."variantId") oi
    WHERE v.id = oi."variantId";
    UPDATE "Coupon" c SET "usedCount" = GREATEST(0, c."usedCount" - u.n)
    FROM (SELECT "couponId", COUNT(*) AS n FROM "CouponUsage" WHERE "userId" = '${id}' GROUP BY "couponId") u
    WHERE c.id = u."couponId";
    DELETE FROM "Order" WHERE "userId" = '${id}';
    DELETE FROM "User" WHERE id = '${id}';`);
}
