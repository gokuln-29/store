import { defineConfig } from "prisma/config";

// Load .env for Prisma CLI commands (Node >= 20.12 built-in, no dotenv needed).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment (CI, Docker, Vercel).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
