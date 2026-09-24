import { db } from "@/lib/db";

export type HealthStatus = {
  status: "ok" | "error";
  db: "ok" | "error";
  timestamp: string;
};

export async function checkHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "ok", db: "ok", timestamp };
  } catch (error) {
    console.error("[health] database check failed", error);
    return { status: "error", db: "error", timestamp };
  }
}
