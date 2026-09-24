import { describe, expect, it } from "vitest";
import { createMemoryRateLimitStore, rateLimit } from "@/lib/services/rate-limit.service";

describe("rateLimit", () => {
  const rule = { key: "test", limit: 3, windowMs: 60_000 };

  it("allows up to the limit, then blocks with a retry time", async () => {
    const store = createMemoryRateLimitStore();
    const start = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(store, rule, start)).allowed).toBe(true);
    }
    const blocked = await rateLimit(store, rule, new Date(start.getTime() + 20_000));
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 40 });
  });

  it("starts a new window after it expires", async () => {
    const store = createMemoryRateLimitStore();
    const start = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 4; i++) await rateLimit(store, rule, start);
    const later = await rateLimit(store, rule, new Date(start.getTime() + 60_000));
    expect(later.allowed).toBe(true);
    expect(later.remaining).toBe(2);
  });

  it("keeps separate keys independent", async () => {
    const store = createMemoryRateLimitStore();
    for (let i = 0; i < 4; i++) await rateLimit(store, rule);
    expect((await rateLimit(store, { ...rule, key: "other" })).allowed).toBe(true);
  });
});

describe("rateLimit reset", () => {
  it("clears a bucket so the next hit starts fresh", async () => {
    const store = createMemoryRateLimitStore();
    const rule = { key: "login:a", limit: 1, windowMs: 60_000 };
    await rateLimit(store, rule);
    expect((await rateLimit(store, rule)).allowed).toBe(false);
    await store.reset(rule.key);
    expect((await rateLimit(store, rule)).allowed).toBe(true);
  });
});
