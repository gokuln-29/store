import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { z } from "zod";
import type { profileSchema } from "@/lib/validators/auth";

export function getProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      preferredLocale: true,
      role: true,
      cartReminders: true,
    },
  });
}

export type UpdateProfileResult = { ok: true } | { ok: false; error: "email_taken" | "not_found" };

export async function updateProfile(
  userId: string,
  data: z.output<typeof profileSchema>,
): Promise<UpdateProfileResult> {
  const current = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!current) return { ok: false, error: "not_found" };
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
        preferredLocale: data.preferredLocale,
        // A changed email must be verified again (verification flow comes with email notifications).
        ...(data.email !== current.email ? { emailVerifiedAt: null } : {}),
      },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "email_taken" };
    }
    throw error;
  }
}
