export type RateLimitRule = {
  /** Unique bucket, e.g. "admin-login:ip:1.2.3.4". */
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  /** Atomically increments the counter for `key`, starting a new window if the old one expired. */
  hit(key: string, windowMs: number, now: Date): Promise<{ count: number; resetAt: Date }>;
  /** Clears a bucket, e.g. after a successful login. */
  reset(key: string): Promise<void>;
}

/** Fixed-window rate limiter. Each call counts as one attempt. */
export async function rateLimit(
  store: RateLimitStore,
  rule: RateLimitRule,
  now = new Date(),
): Promise<RateLimitResult> {
  const { count, resetAt } = await store.hit(rule.key, rule.windowMs, now);
  const allowed = count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}

/** In-memory store for tests and scripts. Not shared between processes. */
export function createMemoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: Date }>();
  return {
    async hit(key, windowMs, now) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        const fresh = { count: 1, resetAt: new Date(now.getTime() + windowMs) };
        buckets.set(key, fresh);
        return { ...fresh };
      }
      bucket.count += 1;
      return { ...bucket };
    },
    async reset(key) {
      buckets.delete(key);
    },
  };
}

const MINUTE = 60_000;

/** Central place for limits so they are easy to review and tune. */
export const RATE_LIMITS = {
  adminLoginByIp: (ip: string): RateLimitRule => ({
    key: `admin-login:ip:${ip}`,
    limit: 20,
    windowMs: 15 * MINUTE,
  }),
  adminLoginByEmail: (email: string): RateLimitRule => ({
    key: `admin-login:email:${email}`,
    limit: 5,
    windowMs: 15 * MINUTE,
  }),
  otpSendByIp: (ip: string): RateLimitRule => ({
    key: `otp-send:ip:${ip}`,
    limit: 20,
    windowMs: 60 * MINUTE,
  }),
  otpVerifyByIp: (ip: string): RateLimitRule => ({
    key: `otp-verify:ip:${ip}`,
    limit: 30,
    windowMs: 15 * MINUTE,
  }),
} as const;
