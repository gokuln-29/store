import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { CouponData } from "@/lib/validators/coupons";
import { audit, diff } from "./audit.service";

export type CouponState = "active" | "scheduled" | "expired" | "used_up" | "disabled";

export function couponState(
  c: {
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    usageLimit: number | null;
    usedCount: number;
  },
  now = new Date(),
): CouponState {
  if (!c.isActive) return "disabled";
  if (c.endsAt && c.endsAt < now) return "expired";
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return "used_up";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "active";
}

/** Orders that count for revenue: paid or placed, not cancelled. */
const COUNTED = { notIn: ["PENDING_PAYMENT", "CANCELLED"] as const };

/** Uses, discount given and revenue from orders that used each coupon. */
export async function couponStats(ids: string[]) {
  if (!ids.length) return new Map<string, { uses: number; discount: number; revenue: number }>();
  const [usage, revenue] = await Promise.all([
    db.couponUsage.groupBy({
      by: ["couponId"],
      where: { couponId: { in: ids }, order: { status: { notIn: [...COUNTED.notIn] } } },
      _count: { _all: true },
      _sum: { discountAmount: true },
    }),
    db.order.groupBy({
      by: ["couponId"],
      where: { couponId: { in: ids }, status: { notIn: [...COUNTED.notIn] } },
      _sum: { total: true },
    }),
  ]);
  const stats = new Map(ids.map((id) => [id, { uses: 0, discount: 0, revenue: 0 }]));
  for (const u of usage) {
    Object.assign(stats.get(u.couponId)!, {
      uses: u._count._all,
      discount: u._sum.discountAmount ?? 0,
    });
  }
  for (const r of revenue) if (r.couponId) stats.get(r.couponId)!.revenue = r._sum.total ?? 0;
  return stats;
}

export async function listCoupons(query: {
  page: number;
  pageSize: number;
  q?: string;
  state?: "active" | "disabled";
}) {
  const where: Prisma.CouponWhereInput = {
    ...(query.q ? { code: { contains: query.q.toUpperCase() } } : {}),
    ...(query.state ? { isActive: query.state === "active" } : {}),
  };
  const [rows, total] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.coupon.count({ where }),
  ]);
  const stats = await couponStats(rows.map((r) => r.id));
  return { rows: rows.map((r) => ({ ...r, stats: stats.get(r.id)! })), total };
}

export async function getCoupon(id: string) {
  const coupon = await db.coupon.findUnique({ where: { id } });
  if (!coupon) return null;
  const [stats, recentOrders, products] = await Promise.all([
    couponStats([id]),
    db.order.findMany({
      where: { couponId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        discountTotal: true,
        status: true,
        createdAt: true,
      },
    }),
    db.product.findMany({
      where: { id: { in: coupon.productIds } },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return { coupon, stats: stats.get(id)!, recentOrders, products };
}

type SaveResult = { ok: true; id: string } | { ok: false; error: "couponCodeTaken" | "not_found" };

function toData(data: CouponData) {
  return {
    ...data,
    description: (data.description ?? Prisma.DbNull) as Prisma.InputJsonValue,
  };
}

export async function saveCoupon(
  id: string | null,
  data: CouponData,
  actorId: string,
): Promise<SaveResult> {
  try {
    return await db.$transaction(async (tx) => {
      if (!id) {
        const created = await tx.coupon.create({ data: toData(data), select: { id: true } });
        await audit(
          {
            actorId,
            action: "coupon.create",
            entityType: "Coupon",
            entityId: created.id,
            changes: { code: data.code },
          },
          tx,
        );
        return { ok: true as const, id: created.id };
      }
      const before = await tx.coupon.findUnique({ where: { id } });
      if (!before) return { ok: false as const, error: "not_found" as const };
      await tx.coupon.update({ where: { id }, data: toData(data) });
      await audit(
        {
          actorId,
          action: "coupon.update",
          entityType: "Coupon",
          entityId: id,
          changes: diff(
            before as unknown as Record<string, unknown>,
            data as unknown as Record<string, unknown>,
          ) as Prisma.InputJsonValue,
        },
        tx,
      );
      return { ok: true as const, id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "couponCodeTaken" };
    }
    throw error;
  }
}

export async function setCouponActive(
  id: string,
  isActive: boolean,
  actorId: string,
): Promise<boolean> {
  const { count } = await db.coupon.updateMany({ where: { id }, data: { isActive } });
  if (count) {
    await audit({
      actorId,
      action: isActive ? "coupon.enable" : "coupon.disable",
      entityType: "Coupon",
      entityId: id,
    });
  }
  return count === 1;
}

/** Only never-used coupons can be deleted (used ones are kept for order history: disable them). */
export async function deleteCoupon(
  id: string,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: "coupon_used" | "not_found" }> {
  const coupon = await db.coupon.findUnique({
    where: { id },
    select: { code: true, _count: { select: { usages: true, orders: true } } },
  });
  if (!coupon) return { ok: false, error: "not_found" };
  if (coupon._count.usages || coupon._count.orders) return { ok: false, error: "coupon_used" };
  await db.coupon.delete({ where: { id } });
  await audit({
    actorId,
    action: "coupon.delete",
    entityType: "Coupon",
    entityId: id,
    changes: { code: coupon.code },
  });
  return { ok: true };
}

/** Products for the "only these products" picker. */
export function searchProductsForPicker(q: string) {
  return db.product.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...(q
        ? {
            OR: [
              { searchText: { contains: q.toLowerCase() } },
              { slug: { contains: q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, name: true, slug: true },
  });
}

export function couponCategoryOptions() {
  return db.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, parentId: true },
  });
}
