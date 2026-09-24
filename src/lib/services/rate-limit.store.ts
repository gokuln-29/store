import { db } from "@/lib/db";
import type { RateLimitStore } from "./rate-limit.service";

/** Postgres-backed store: works across multiple app instances without Redis. */
export const postgresRateLimitStore: RateLimitStore = {
  async hit(key, windowMs, now) {
    const resetAt = new Date(now.getTime() + windowMs);
    const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN EXCLUDED."expiresAt" ELSE "RateLimit"."expiresAt" END
      RETURNING "count", "expiresAt"`;
    const row = rows[0];
    if (!row) throw new Error("Rate limit upsert returned no row");

    // Occasionally clear out expired buckets so the table stays small.
    if (Math.random() < 0.01) {
      await db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => undefined);
    }
    return { count: Number(row.count), resetAt: row.expiresAt };
  },
  async reset(key) {
    await db.rateLimit.deleteMany({ where: { key } });
  },
};
