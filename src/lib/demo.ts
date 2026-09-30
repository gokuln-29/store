import { db } from "@/lib/db";
import type { Permission } from "@/lib/permissions";
import { demoAdminCredentials, isDemoMode } from "./demo-config";

export { DEMO_OTP_CODE, demoAdminCredentials, isDemoMode } from "./demo-config";

/*
 * Demo mode (DEMO_MODE=true) turns a deployment into a public showcase:
 * - customers sign in with any mobile number and DEMO_OTP_CODE (demo-config.ts); no SMS is sent;
 * - online payments use the test provider, so no money moves;
 * - a demo admin account can open every admin page but cannot change anything.
 * It is off by default and must never be enabled for a real store.
 */

/** Permissions that change data: the demo admin never gets these. */
const WRITE_PERMISSIONS = new Set<Permission>([
  "catalog:write",
  "orders:manage",
  "payments:refund",
  "coupons:manage",
  "content:manage",
  "settings:manage",
  "staff:manage",
]);

export function isWritePermission(permission: Permission): boolean {
  return WRITE_PERMISSIONS.has(permission);
}

let demoAdminId: string | null | undefined;

/** True for the read-only demo admin account (only ever in demo mode). */
export async function isReadOnlyDemoUser(userId: string): Promise<boolean> {
  if (!isDemoMode()) return false;
  if (demoAdminId === undefined) {
    const user = await db.user.findUnique({
      where: { email: demoAdminCredentials().email },
      select: { id: true },
    });
    demoAdminId = user?.id ?? null;
  }
  return demoAdminId === userId;
}
