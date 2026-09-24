import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export type AuditEntry = {
  actorId: string | null;
  /** e.g. "settings.update", "product.create", "staff.deactivate" */
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
};

/**
 * Records an admin mutation. Pass the transaction client so the audit row is written
 * atomically with the change it describes.
 */
export async function audit(entry: AuditEntry, tx: Tx = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      changes: entry.changes,
    },
  });
}

/** Returns only the fields that changed, as { field: { from, to } }. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

export type AuditQuery = {
  page: number;
  pageSize: number;
  entityType?: string;
  actorId?: string;
  q?: string;
};

export async function listAuditLogs({ page, pageSize, entityType, actorId, q }: AuditQuery) {
  const where: Prisma.AuditLogWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(actorId ? { actorId } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total };
}

export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await db.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}
