import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/providers/storage";
import type { ProductStatus } from "@/generated/prisma/client";
import { audit } from "./audit.service";
import {
  buildProductInput,
  fieldErrorsToRows,
  groupByHandle,
  parseProductCsv,
  productsToCsv,
  validateInput,
  type ImportContext,
  type ProductGroup,
  type RowError,
} from "./product-csv";
import { saveProductInTx } from "./product.service";
import { logger } from "@/lib/logger";

const log = logger("import");

// ───────────── Export ─────────────

/** All attribute keys across categories, in category/attribute order, without duplicates. */
async function attributeKeys(): Promise<string[]> {
  const defs = await db.attributeDefinition.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { key: true },
  });
  return [...new Set(defs.map((d) => d.key))];
}

export async function exportProductsCsv(
  opts: { status?: ProductStatus; templateOnly?: boolean } = {},
) {
  const keys = await attributeKeys();
  if (opts.templateOnly) return productsToCsv([], keys);
  const products = await db.product.findMany({
    where: opts.status ? { status: opts.status } : { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "asc" },
    include: {
      category: { select: { slug: true } },
      variants: { orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] },
      images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
  });
  return productsToCsv(
    products.map((p) => ({ ...p, categorySlug: p.category.slug })),
    keys,
  );
}

// ───────────── Import ─────────────

export type ImportedProduct = {
  handle: string;
  firstRow: number;
  lastRow: number;
  action: "create" | "update";
  ok: boolean;
  errors: RowError[];
};

export type ImportReport = {
  dryRun: boolean;
  totalRows: number;
  fileErrors: RowError[];
  products: ImportedProduct[];
  summary: { created: number; updated: number; failed: number };
};

class DryRunRollback extends Error {}

const toLocalized = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};

async function loadContexts(groups: ProductGroup[]) {
  const categorySlugs = [
    ...new Set(groups.map((g) => (g.rows[0]!.cells.category ?? "").toLowerCase())),
  ];
  const [categories, existing] = await Promise.all([
    db.category.findMany({
      where: { slug: { in: categorySlugs } },
      select: { id: true, slug: true, attributes: { select: { key: true } } },
    }),
    db.product.findMany({
      where: { slug: { in: groups.map((g) => g.handle) } },
      select: {
        id: true,
        slug: true,
        options: true,
        variants: { select: { id: true, sku: true } },
        images: { orderBy: { sortOrder: "asc" }, select: { url: true, publicId: true, alt: true } },
      },
    }),
  ]);
  return (group: ProductGroup): ImportContext => {
    const category = categories.find(
      (c) => c.slug === (group.rows[0]!.cells.category ?? "").toLowerCase(),
    );
    const product = existing.find((p) => p.slug === group.handle);
    return {
      category: category && {
        id: category.id,
        attributeKeys: category.attributes.map((a) => a.key),
      },
      existing: product && {
        id: product.id,
        options: (
          (product.options as {
            key: string;
            label: unknown;
            values: { value: string; label: unknown }[];
          }[]) ?? []
        ).map((o) => ({
          key: o.key,
          label: toLocalized(o.label),
          values: o.values.map((v) => ({ value: v.value, label: toLocalized(v.label) })),
        })),
        variants: product.variants,
        images: product.images.map((i) => ({ ...i, alt: toLocalized(i.alt) })),
      },
    };
  };
}

/**
 * Imports products from CSV. With `dryRun`, everything is validated (including database
 * checks such as SKU conflicts) inside a transaction that is rolled back.
 */
export async function importProductsCsv(
  csv: string,
  opts: { dryRun: boolean; actorId: string },
): Promise<ImportReport> {
  const parsed = parseProductCsv(csv);
  const report: ImportReport = {
    dryRun: opts.dryRun,
    totalRows: parsed.rows.length,
    fileErrors: parsed.errors,
    products: [],
    summary: { created: 0, updated: 0, failed: 0 },
  };
  if (parsed.errors.some((e) => e.row === null)) return report;

  const { groups, errors: groupErrors } = groupByHandle(parsed.rows);
  report.fileErrors.push(...groupErrors);
  const contextFor = await loadContexts(groups);

  const prepared = groups.map((group) => {
    const ctx = contextFor(group);
    const entry: ImportedProduct = {
      handle: group.handle,
      firstRow: group.rows[0]!.line,
      lastRow: group.rows.at(-1)!.line,
      action: ctx.existing ? "update" : "create",
      ok: false,
      errors: [],
    };
    const built = buildProductInput(group, ctx);
    if (!built.input) {
      entry.errors = built.errors;
      return { group, ctx, entry, data: null };
    }
    const validated = validateInput(group, built.input);
    entry.errors = validated.errors;
    return { group, ctx, entry, data: validated.data };
  });

  const removedPublicIds: string[] = [];
  const saveOne = async (tx: Prisma.TransactionClient, item: (typeof prepared)[number]) => {
    if (!item.data) return;
    const result = await saveProductInTx(
      tx,
      item.ctx.existing?.id ?? null,
      item.data,
      opts.actorId,
      removedPublicIds,
    );
    if (result.ok) item.entry.ok = true;
    else
      item.entry.errors = result.fieldErrors
        ? fieldErrorsToRows(item.group, result.fieldErrors)
        : [{ row: item.entry.firstRow, column: null, message: result.error }];
  };

  if (opts.dryRun) {
    try {
      await db.$transaction(
        async (tx) => {
          for (const item of prepared) await saveOne(tx, item);
          throw new DryRunRollback();
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }
  } else {
    // Each product in its own transaction, so one bad product doesn't block the rest.
    for (const item of prepared) {
      try {
        await db.$transaction((tx) => saveOne(tx, item), { timeout: 20_000 });
      } catch (error) {
        log.error("product import row failed", { handle: item.group.handle }, error);
        item.entry.ok = false;
        item.entry.errors = [{ row: item.entry.firstRow, column: null, message: "unknown" }];
      }
    }
    if (removedPublicIds.length) {
      const storage = getStorageProvider();
      await Promise.allSettled(removedPublicIds.map((id) => storage.delete(id)));
    }
  }

  report.products = prepared.map((p) => p.entry);
  for (const p of report.products) {
    if (!p.ok) report.summary.failed++;
    else if (p.action === "create") report.summary.created++;
    else report.summary.updated++;
  }
  if (!opts.dryRun) {
    await audit({
      actorId: opts.actorId,
      action: "product.import",
      entityType: "Product",
      changes: { rows: report.totalRows, ...report.summary },
    });
  }
  return report;
}
