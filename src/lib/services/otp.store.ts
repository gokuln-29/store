import { db } from "@/lib/db";
import type { OtpStore } from "./otp.service";

export const postgresOtpStore: OtpStore = {
  countCreatedSince(phone, since) {
    return db.otpCode.count({ where: { phone, createdAt: { gte: since } } });
  },

  findLatest(phone) {
    return db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  },

  async replaceActive({ phone, codeHash, expiresAt, ip, now }) {
    await db.$transaction([
      db.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: now } }),
      db.otpCode.create({ data: { phone, codeHash, expiresAt, ip } }),
    ]);
  },

  async incrementAttempts(id, max) {
    const { count } = await db.otpCode.updateMany({
      where: { id, attempts: { lt: max } },
      data: { attempts: { increment: 1 } },
    });
    return count === 1;
  },

  async consume(id, now) {
    const { count } = await db.otpCode.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: now },
    });
    return count === 1;
  },
};
