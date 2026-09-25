import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { SmsProvider } from "@/lib/providers/notify/types";

export const OTP_CONFIG = {
  length: 6,
  ttlMs: 5 * 60_000,
  maxAttempts: 5,
  resendCooldownMs: 30_000,
  maxSendsPerHour: 5,
} as const;

export type OtpRecord = {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
};

export interface OtpStore {
  countCreatedSince(phone: string, since: Date): Promise<number>;
  findLatest(phone: string): Promise<OtpRecord | null>;
  /** Marks all unconsumed codes for the phone as consumed, then stores the new one. */
  replaceActive(data: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    ip: string | null;
    now: Date;
  }): Promise<void>;
  /** Atomically increments attempts if still below `max`. Returns false if the limit was reached. */
  incrementAttempts(id: string, max: number): Promise<boolean>;
  /** Atomically marks the code as used. Returns false if it was already used. */
  consume(id: string, now: Date): Promise<boolean>;
}

export type OtpDeps = {
  store: OtpStore;
  sms: Pick<SmsProvider, "name" | "sendOtp">;
  secret: string;
  now?: () => Date;
  generateCode?: () => string;
};

export type RequestOtpResult =
  | { ok: true; resendAfterSeconds: number; expiresInSeconds: number }
  | { ok: false; error: "cooldown" | "too_many_requests"; retryAfterSeconds: number };

export type VerifyOtpResult =
  { ok: true } | { ok: false; error: "invalid_code" | "expired" | "too_many_attempts" };

export function hashOtp(secret: string, phone: string, code: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

function defaultGenerateCode(): string {
  return randomInt(0, 10 ** OTP_CONFIG.length)
    .toString()
    .padStart(OTP_CONFIG.length, "0");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createOtpService(deps: OtpDeps) {
  const now = deps.now ?? (() => new Date());
  const generateCode = deps.generateCode ?? defaultGenerateCode;

  async function requestOtp(input: {
    phone: string;
    locale: string;
    ip: string | null;
  }): Promise<RequestOtpResult> {
    const current = now();
    const latest = await deps.store.findLatest(input.phone);

    if (latest) {
      const cooldownEnds = latest.createdAt.getTime() + OTP_CONFIG.resendCooldownMs;
      if (cooldownEnds > current.getTime()) {
        return {
          ok: false,
          error: "cooldown",
          retryAfterSeconds: Math.ceil((cooldownEnds - current.getTime()) / 1000),
        };
      }
    }

    const hourAgo = new Date(current.getTime() - 60 * 60_000);
    const sentLastHour = await deps.store.countCreatedSince(input.phone, hourAgo);
    if (sentLastHour >= OTP_CONFIG.maxSendsPerHour) {
      return { ok: false, error: "too_many_requests", retryAfterSeconds: 60 * 60 };
    }

    const code = generateCode();
    await deps.store.replaceActive({
      phone: input.phone,
      codeHash: hashOtp(deps.secret, input.phone, code),
      expiresAt: new Date(current.getTime() + OTP_CONFIG.ttlMs),
      ip: input.ip,
      now: current,
    });
    await deps.sms.sendOtp({
      to: input.phone,
      code,
      locale: input.locale,
      expiresInMinutes: OTP_CONFIG.ttlMs / 60_000,
    });

    return {
      ok: true,
      resendAfterSeconds: OTP_CONFIG.resendCooldownMs / 1000,
      expiresInSeconds: OTP_CONFIG.ttlMs / 1000,
    };
  }

  async function verifyOtp(input: { phone: string; code: string }): Promise<VerifyOtpResult> {
    const current = now();
    const latest = await deps.store.findLatest(input.phone);

    if (!latest || latest.consumedAt || latest.expiresAt <= current) {
      return { ok: false, error: "expired" };
    }
    // Count the attempt before comparing so parallel guesses cannot exceed the limit.
    const counted = await deps.store.incrementAttempts(latest.id, OTP_CONFIG.maxAttempts);
    if (!counted) return { ok: false, error: "too_many_attempts" };

    const matches = safeEqualHex(latest.codeHash, hashOtp(deps.secret, input.phone, input.code));
    if (!matches) {
      return latest.attempts + 1 >= OTP_CONFIG.maxAttempts
        ? { ok: false, error: "too_many_attempts" }
        : { ok: false, error: "invalid_code" };
    }

    const consumed = await deps.store.consume(latest.id, current);
    return consumed ? { ok: true } : { ok: false, error: "expired" };
  }

  return { requestOtp, verifyOtp };
}

export type OtpService = ReturnType<typeof createOtpService>;
