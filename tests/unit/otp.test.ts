import { beforeEach, describe, expect, it } from "vitest";
import type { OtpMessage, SmsProvider } from "@/lib/providers/notify/types";
import {
  createOtpService,
  hashOtp,
  OTP_CONFIG,
  type OtpRecord,
  type OtpStore,
} from "@/lib/services/otp.service";

function createMemoryOtpStore() {
  const records: OtpRecord[] = [];
  let nextId = 1;
  const store: OtpStore = {
    async countCreatedSince(phone, since) {
      return records.filter((r) => r.phone === phone && r.createdAt >= since).length;
    },
    async findLatest(phone) {
      const matches = records.filter((r) => r.phone === phone);
      return matches.length ? { ...matches[matches.length - 1]! } : null;
    },
    async replaceActive({ phone, codeHash, expiresAt, now }) {
      for (const r of records) if (r.phone === phone && !r.consumedAt) r.consumedAt = now;
      records.push({
        id: String(nextId++),
        phone,
        codeHash,
        expiresAt,
        attempts: 0,
        consumedAt: null,
        createdAt: now,
      });
    },
    async incrementAttempts(id, max) {
      const r = records.find((x) => x.id === id);
      if (!r || r.attempts >= max) return false;
      r.attempts += 1;
      return true;
    },
    async consume(id, now) {
      const r = records.find((x) => x.id === id);
      if (!r || r.consumedAt) return false;
      r.consumedAt = now;
      return true;
    },
  };
  return { store, records };
}

const PHONE = "+919876543210";
const SECRET = "test-secret";

describe("OTP service", () => {
  let clock: Date;
  let sent: OtpMessage[];
  let memory: ReturnType<typeof createMemoryOtpStore>;
  let codes: string[];
  let service: ReturnType<typeof createOtpService>;

  const advance = (ms: number) => {
    clock = new Date(clock.getTime() + ms);
  };

  beforeEach(() => {
    clock = new Date("2026-01-01T10:00:00Z");
    sent = [];
    memory = createMemoryOtpStore();
    codes = ["111111", "222222", "333333", "444444", "555555", "666666"];
    const sms: Pick<SmsProvider, "name" | "sendOtp"> = {
      name: "memory",
      sendOtp: async (m) => void sent.push(m),
    };
    service = createOtpService({
      store: memory.store,
      sms,
      secret: SECRET,
      now: () => clock,
      generateCode: () => codes.shift() ?? "999999",
    });
  });

  it("sends a code and stores only its hash", async () => {
    const result = await service.requestOtp({ phone: PHONE, locale: "ta", ip: "1.1.1.1" });
    expect(result).toEqual({ ok: true, resendAfterSeconds: 30, expiresInSeconds: 300 });
    expect(sent).toEqual([{ to: PHONE, code: "111111", locale: "ta", expiresInMinutes: 5 }]);
    expect(memory.records[0]!.codeHash).toBe(hashOtp(SECRET, PHONE, "111111"));
    expect(memory.records[0]!.codeHash).not.toContain("111111");
  });

  it("reports a failed SMS instead of throwing, and still applies the resend cooldown", async () => {
    const failing = createOtpService({
      store: memory.store,
      sms: {
        name: "down",
        sendOtp: async () => {
          throw new Error("gateway timeout");
        },
      },
      secret: SECRET,
      now: () => clock,
      generateCode: () => "111111",
    });
    expect(await failing.requestOtp({ phone: PHONE, locale: "en", ip: null })).toEqual({
      ok: false,
      error: "send_failed",
    });
    const again = await failing.requestOtp({ phone: PHONE, locale: "en", ip: null });
    expect(again).toMatchObject({ ok: false, error: "cooldown" });
  });

  it("verifies the correct code once", async () => {
    await service.requestOtp({ phone: PHONE, locale: "en", ip: null });
    expect(await service.verifyOtp({ phone: PHONE, code: "111111" })).toEqual({ ok: true });
    expect(await service.verifyOtp({ phone: PHONE, code: "111111" })).toEqual({
      ok: false,
      error: "expired",
    });
  });

  it("rejects a wrong code and locks after too many attempts", async () => {
    await service.requestOtp({ phone: PHONE, locale: "en", ip: null });
    for (let i = 1; i < OTP_CONFIG.maxAttempts; i++) {
      expect(await service.verifyOtp({ phone: PHONE, code: "000000" })).toEqual({
        ok: false,
        error: "invalid_code",
      });
    }
    expect(await service.verifyOtp({ phone: PHONE, code: "000000" })).toEqual({
      ok: false,
      error: "too_many_attempts",
    });
    // Even the right code is refused once locked.
    expect(await service.verifyOtp({ phone: PHONE, code: "111111" })).toEqual({
      ok: false,
      error: "too_many_attempts",
    });
  });

  it("expires codes after 5 minutes", async () => {
    await service.requestOtp({ phone: PHONE, locale: "en", ip: null });
    advance(OTP_CONFIG.ttlMs);
    expect(await service.verifyOtp({ phone: PHONE, code: "111111" })).toEqual({
      ok: false,
      error: "expired",
    });
  });

  it("enforces a resend cooldown and invalidates the previous code", async () => {
    await service.requestOtp({ phone: PHONE, locale: "en", ip: null });
    advance(10_000);
    expect(await service.requestOtp({ phone: PHONE, locale: "en", ip: null })).toEqual({
      ok: false,
      error: "cooldown",
      retryAfterSeconds: 20,
    });

    advance(20_000);
    expect((await service.requestOtp({ phone: PHONE, locale: "en", ip: null })).ok).toBe(true);
    expect(await service.verifyOtp({ phone: PHONE, code: "111111" })).toEqual({
      ok: false,
      error: "invalid_code",
    });
    expect(await service.verifyOtp({ phone: PHONE, code: "222222" })).toEqual({ ok: true });
  });

  it("limits sends per phone per hour", async () => {
    for (let i = 0; i < OTP_CONFIG.maxSendsPerHour; i++) {
      expect((await service.requestOtp({ phone: PHONE, locale: "en", ip: null })).ok).toBe(true);
      advance(OTP_CONFIG.resendCooldownMs);
    }
    expect(await service.requestOtp({ phone: PHONE, locale: "en", ip: null })).toMatchObject({
      ok: false,
      error: "too_many_requests",
    });
    advance(60 * 60_000);
    expect((await service.requestOtp({ phone: PHONE, locale: "en", ip: null })).ok).toBe(true);
  });

  it("returns expired when no code was requested", async () => {
    expect(await service.verifyOtp({ phone: PHONE, code: "123456" })).toEqual({
      ok: false,
      error: "expired",
    });
  });
});
