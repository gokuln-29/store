import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile();
} catch {
  // No .env: rely on the real environment (CI).
}
const env = process.env;

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Point the app's Prisma client at the test database before any module loads.
          env: {
            DATABASE_URL: env.DATABASE_URL_TEST ?? "",
            AUTH_SECRET: "integration-test-secret",
          },
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Tests share one database, so run files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
