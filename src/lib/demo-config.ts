/** Demo-mode settings without database access (shared with prisma/seed.ts). See demo.ts. */

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** The login code every demo customer uses (shown on the login page). */
export const DEMO_OTP_CODE = "123456";

export function demoAdminCredentials(): { email: string; password: string } {
  return {
    email: (process.env.DEMO_ADMIN_EMAIL ?? "demo@example.com").trim().toLowerCase(),
    password: process.env.DEMO_ADMIN_PASSWORD ?? "DemoAdmin@123",
  };
}
