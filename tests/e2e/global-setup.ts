import { execSync } from "node:child_process";

/**
 * Clears rate-limit counters and OTPs so repeated local runs don't lock out test accounts.
 * Uses the Prisma CLI (reads DATABASE_URL via prisma.config.ts) because the generated
 * client is ESM-only and Playwright loads this file as CommonJS.
 */
export default function globalSetup() {
  execSync("pnpm exec prisma db execute --stdin", {
    input: 'DELETE FROM "RateLimit"; DELETE FROM "OtpCode";',
    stdio: ["pipe", "ignore", "inherit"],
  });
}
