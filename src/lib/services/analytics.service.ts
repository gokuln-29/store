import type { FunnelStep } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/** "YYYY-MM-DD" of a moment in India time. */
export function istDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

/** Counts a funnel step once per session per day (repeats are ignored). */
export async function recordFunnelEvent(
  sessionId: string,
  step: FunnelStep,
  now = new Date(),
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO "FunnelEvent" ("day", "sessionId", "step")
    VALUES (${istDay(now)}::date, ${sessionId}::uuid, ${step}::"FunnelStep")
    ON CONFLICT DO NOTHING`;
}

/** Keeps about 13 months of funnel data. */
export async function pruneFunnelEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 400 * 24 * 60 * 60_000);
  return db.$executeRaw`DELETE FROM "FunnelEvent" WHERE "day" < ${istDay(cutoff)}::date`;
}

const BOT = /bot|crawl|spider|slurp|lighthouse|headless|preview|monitor|curl|wget|python|java\//i;
export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent);
}
