import { verify } from "@node-rs/argon2";
import { Prisma, type Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "./audit.service";
import { hashPassword } from "./auth.service";

export type StaffQuery = {
  page: number;
  pageSize: number;
  q?: string;
  sort: "name" | "email" | "createdAt" | "lastLoginAt";
  dir: "asc" | "desc";
};

export async function listStaff({ page, pageSize, q, sort, dir }: StaffQuery) {
  const where: Prisma.UserWhereInput = {
    role: { in: ["OWNER", "STAFF"] },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await db.$transaction([
    db.user.findMany({
      where,
      // "nulls last" is only valid on nullable columns.
      orderBy: sort === "createdAt" ? { createdAt: dir } : { [sort]: { sort: dir, nulls: "last" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    db.user.count({ where }),
  ]);
  return { rows, total };
}

type StaffError = "email_taken" | "not_found" | "cannot_change_self" | "last_owner";
type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: StaffError };

export async function createStaff(
  input: { name: string; email: string; role: "OWNER" | "STAFF"; password: string },
  actorId: string,
): Promise<Result<{ id: string }>> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
      await audit(
        {
          actorId,
          action: "staff.create",
          entityType: "User",
          entityId: created.id,
          changes: { email: input.email, role: input.role },
        },
        tx,
      );
      return created;
    });
    return { ok: true, data: user };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "email_taken" };
    }
    throw error;
  }
}

async function activeOwnerCount(tx: Prisma.TransactionClient) {
  return tx.user.count({ where: { role: "OWNER", isActive: true } });
}

/** Activates/deactivates a staff account. Deactivation ends their sessions. */
export async function setStaffActive(
  id: string,
  isActive: boolean,
  actorId: string,
): Promise<Result> {
  if (id === actorId) return { ok: false, error: "cannot_change_self" };
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id, role: { in: ["OWNER", "STAFF"] } } });
    if (!user) return { ok: false, error: "not_found" } as const;
    if (!isActive && user.role === "OWNER" && user.isActive && (await activeOwnerCount(tx)) <= 1) {
      return { ok: false, error: "last_owner" } as const;
    }
    await tx.user.update({
      where: { id },
      data: { isActive, ...(isActive ? {} : { sessionVersion: { increment: 1 } }) },
    });
    await audit(
      {
        actorId,
        action: isActive ? "staff.activate" : "staff.deactivate",
        entityType: "User",
        entityId: id,
      },
      tx,
    );
    return { ok: true, data: undefined } as const;
  });
}

export async function setStaffRole(
  id: string,
  role: "OWNER" | "STAFF",
  actorId: string,
): Promise<Result> {
  if (id === actorId) return { ok: false, error: "cannot_change_self" };
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id, role: { in: ["OWNER", "STAFF"] } } });
    if (!user) return { ok: false, error: "not_found" } as const;
    if (user.role === role) return { ok: true, data: undefined } as const;
    if (user.role === "OWNER" && user.isActive && (await activeOwnerCount(tx)) <= 1) {
      return { ok: false, error: "last_owner" } as const;
    }
    await tx.user.update({
      where: { id },
      data: { role: role as Role, sessionVersion: { increment: 1 } },
    });
    await audit(
      {
        actorId,
        action: "staff.role_change",
        entityType: "User",
        entityId: id,
        changes: { from: user.role, to: role },
      },
      tx,
    );
    return { ok: true, data: undefined } as const;
  });
}

/** Owner sets a new password for a staff member; their sessions end. */
export async function resetStaffPassword(
  id: string,
  password: string,
  actorId: string,
): Promise<Result> {
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id, role: { in: ["OWNER", "STAFF"] } } });
    if (!user) return { ok: false, error: "not_found" } as const;
    await tx.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await audit({ actorId, action: "staff.password_reset", entityType: "User", entityId: id }, tx);
    return { ok: true, data: undefined } as const;
  });
}

/** A signed-in staff member changes their own password; all their sessions end. */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: "wrong_password" | "not_found" }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) return { ok: false, error: "not_found" };
  const valid = await verify(user.passwordHash, currentPassword).catch(() => false);
  if (!valid) return { ok: false, error: "wrong_password" };

  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await audit(
      { actorId: userId, action: "staff.password_change", entityType: "User", entityId: userId },
      tx,
    );
  });
  return { ok: true };
}
