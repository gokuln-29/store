import { db } from "@/lib/db";
import { stateNameFromCode } from "@/lib/constants/indian-states";
import type { AddressData } from "@/lib/validators/auth";

export const MAX_ADDRESSES_PER_USER = 20;

export type AddressResult =
  { ok: true; id: string } | { ok: false; error: "not_found" | "limit_reached" };

export function listAddresses(userId: string) {
  return db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    take: MAX_ADDRESSES_PER_USER,
  });
}

export function getAddress(userId: string, id: string) {
  return db.address.findFirst({ where: { id, userId } });
}

function toRow(data: AddressData) {
  const { isDefault: _isDefault, ...rest } = data;
  return { ...rest, state: stateNameFromCode(data.stateCode) ?? data.stateCode, country: "IN" };
}

/** Creates or updates an address. Exactly one address per user is the default. */
export async function saveAddress(
  userId: string,
  id: string | null,
  data: AddressData,
): Promise<AddressResult> {
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });

    if (id) {
      const existing = await tx.address.findFirst({
        where: { id, userId },
        select: { isDefault: true },
      });
      if (!existing) return { ok: false, error: "not_found" } as const;
      // The only address, or the current default, stays default.
      const makeDefault = data.isDefault || existing.isDefault || count === 1;
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId, NOT: { id } }, data: { isDefault: false } });
      }
      await tx.address.update({ where: { id }, data: { ...toRow(data), isDefault: makeDefault } });
      return { ok: true, id } as const;
    }

    if (count >= MAX_ADDRESSES_PER_USER) return { ok: false, error: "limit_reached" } as const;
    const makeDefault = data.isDefault || count === 0;
    if (makeDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const created = await tx.address.create({
      data: { ...toRow(data), userId, isDefault: makeDefault },
      select: { id: true },
    });
    return { ok: true, id: created.id } as const;
  });
}

export async function setDefaultAddress(userId: string, id: string): Promise<AddressResult> {
  return db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return { ok: false, error: "not_found" } as const;
    await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.address.update({ where: { id }, data: { isDefault: true } });
    return { ok: true, id } as const;
  });
}

/** Deletes an address; if it was the default, the most recently updated one becomes default. */
export async function deleteAddress(userId: string, id: string): Promise<AddressResult> {
  return db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id, userId },
      select: { isDefault: true },
    });
    if (!existing) return { ok: false, error: "not_found" } as const;
    await tx.address.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true, id } as const;
  });
}
