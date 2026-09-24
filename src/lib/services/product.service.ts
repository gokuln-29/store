import { Prisma, type ProductStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/providers/storage";
import { sanitizeRichText } from "@/lib/utils/sanitize";
import { buildSearchText } from "@/lib/utils/search-text";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import {
  productAttributesSchema,
  type AttributeDefinitionLike,
  type Choice,
  type ProductAttributes,
} from "@/lib/validators/catalog";
import type { ProductFormData } from "@/lib/validators/catalog-forms";
import { audit, diff } from "./audit.service";

type Tx = Prisma.TransactionClient;
const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

// ───────────── Listing ─────────────

export type ProductQuery = {
  page: number;
  pageSize: number;
  q?: string;
  status?: ProductStatus;
  categoryId?: string;
  sort: "updatedAt" | "createdAt" | "status";
  dir: "asc" | "desc";
};

export async function listProducts({
  page,
  pageSize,
  q,
  status,
  categoryId,
  sort,
  dir,
}: ProductQuery) {
  let nameMatches: string[] = [];
  if (q) {
    // Search the name in every language (JSON text), plus slug and SKU below.
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product" WHERE name::text ILIKE ${`%${q}%`} LIMIT 500`;
    nameMatches = rows.map((r) => r.id);
  }
  const where: Prisma.ProductWhereInput = {
    ...(status ? { status } : { status: { not: "ARCHIVED" } }),
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { id: { in: nameMatches } },
            { slug: { contains: q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  // Separate queries (not a batch transaction): the pg adapter runs batches on one client.
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        isFeatured: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        variants: {
          where: { isActive: true },
          select: { price: true, stock: true, lowStockThreshold: true },
        },
      },
    }),
    db.product.count({ where }),
  ]);
  return {
    total,
    rows: rows.map(({ variants, images, ...p }) => ({
      ...p,
      imageUrl: images[0]?.url ?? null,
      variantCount: variants.length,
      minPrice: variants.length ? Math.min(...variants.map((v) => v.price)) : null,
      maxPrice: variants.length ? Math.max(...variants.map((v) => v.price)) : null,
      totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
      lowStock: variants.some((v) => v.stock <= v.lowStockThreshold),
    })),
  };
}

export function getProductForEdit(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
}

// ───────────── Save ─────────────

export type SaveProductError = "not_found" | "validation";
export type SaveProductResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: SaveProductError; fieldErrors?: Record<string, string> };

/**
 * Converts raw form strings to typed attribute values for the category and validates them.
 * Keys that are no longer defined on the category are dropped.
 */
export function buildAttributes(
  defs: AttributeDefinitionLike[],
  raw: Record<string, string>,
): { ok: true; value: ProductAttributes } | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const typed: Record<string, string | number> = {};
  for (const def of defs) {
    const input = raw[def.key]?.trim() ?? "";
    if (!input) continue;
    if (def.type === "NUMBER") {
      const n = Number(input);
      if (!Number.isFinite(n)) {
        fieldErrors[`attributes.${def.key}`] = "numberInvalid";
        continue;
      }
      typed[def.key] = n;
    } else {
      typed[def.key] = input;
    }
  }
  const parsed = productAttributesSchema(defs).safeParse(typed);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      fieldErrors[`attributes.${key}`] ??=
        typed[key] === undefined ? "required" : "attributeInvalid";
    }
  }
  if (Object.keys(fieldErrors).length || !parsed.success) return { ok: false, fieldErrors };
  return { ok: true, value: parsed.data };
}

function sanitizeDescription(description: Record<string, string> | null) {
  if (!description) return null;
  const clean = Object.fromEntries(
    Object.entries(description)
      .map(([locale, html]) => [locale, sanitizeRichText(html)] as const)
      .filter(([, html]) => html),
  );
  return Object.keys(clean).length ? clean : null;
}

async function findSkuConflicts(tx: Tx, skus: string[], productId: string | null) {
  const rows = await tx.productVariant.findMany({
    where: { sku: { in: skus }, ...(productId ? { NOT: { productId } } : {}) },
    select: { sku: true },
  });
  return new Set(rows.map((r) => r.sku));
}

/**
 * Creates or updates a product using the caller's transaction (used directly by CSV import,
 * which can roll back a whole file). Image files that are no longer used are added to
 * `removedPublicIds` so the caller can delete them after committing.
 */
export async function saveProductInTx(
  tx: Tx,
  id: string | null,
  data: ProductFormData,
  actorId: string,
  removedPublicIds: string[] = [],
): Promise<SaveProductResult> {
  const category = await tx.category.findUnique({
    where: { id: data.categoryId },
    include: { attributes: { orderBy: { sortOrder: "asc" } } },
  });
  if (!category) return { ok: false, error: "validation", fieldErrors: { categoryId: "required" } };

  const defs: AttributeDefinitionLike[] = category.attributes.map((a) => ({
    key: a.key,
    type: a.type,
    isRequired: a.isRequired,
    options: (a.options as Choice[] | null) ?? null,
  }));
  const attributes = buildAttributes(defs, data.attributes);
  if (!attributes.ok)
    return { ok: false, error: "validation", fieldErrors: attributes.fieldErrors };

  {
    const existing = id
      ? await tx.product.findUnique({ where: { id }, include: { variants: true, images: true } })
      : null;
    if (id && !existing) return { ok: false, error: "not_found" };

    // Slug: explicit (must be free) or generated from the English name.
    const slugTaken = async (slug: string) =>
      Boolean(
        await tx.product.findFirst({
          where: { slug, ...(id ? { NOT: { id } } : {}) },
          select: { id: true },
        }),
      );
    let slug: string;
    if (data.slug) {
      if (await slugTaken(data.slug))
        return { ok: false, error: "validation", fieldErrors: { slug: "slugTaken" } };
      slug = data.slug;
    } else {
      slug =
        existing?.slug ?? (await uniqueSlug(slugify(data.name.en ?? "", "product"), slugTaken));
    }

    const conflicts = await findSkuConflicts(
      tx,
      data.variants.map((v) => v.sku),
      id,
    );
    if (conflicts.size) {
      const fieldErrors: Record<string, string> = {};
      data.variants.forEach((v, i) => {
        if (conflicts.has(v.sku)) fieldErrors[`variants.${i}.sku`] = "skuTaken";
      });
      return { ok: false, error: "validation", fieldErrors };
    }

    const fields = {
      slug,
      name: data.name as Prisma.InputJsonValue,
      shortDescription: json(data.shortDescription),
      description: json(sanitizeDescription(data.description)),
      categoryId: data.categoryId,
      status: data.status,
      brand: data.brand,
      isFeatured: data.isFeatured,
      attributes: attributes.value as Prisma.InputJsonValue,
      options: data.options as unknown as Prisma.InputJsonValue,
      taxRateBps: data.taxRateBps,
      hsnCode: data.hsnCode,
      metaTitle: json(data.metaTitle),
      metaDescription: json(data.metaDescription),
      searchText: buildSearchText({
        name: data.name,
        brand: data.brand,
        slug,
        skus: data.variants.map((v) => v.sku),
      }),
      ...(data.status === "PUBLISHED" && !existing?.publishedAt ? { publishedAt: new Date() } : {}),
    };
    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data: fields })
      : await tx.product.create({ data: fields });

    // Variants: update by id, create new, remove the rest (deactivate if already ordered).
    const keptIds = new Set<string>();
    for (const [index, v] of data.variants.entries()) {
      const values = {
        sku: v.sku,
        optionValues: v.optionValues as Prisma.InputJsonValue,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        costPrice: v.costPrice,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold,
        weightGrams: v.weightGrams,
        isActive: v.isActive,
        isDefault: index === 0,
        sortOrder: index,
      };
      const match = v.id ? existing?.variants.find((e) => e.id === v.id) : undefined;
      if (match) {
        await tx.productVariant.update({ where: { id: match.id }, data: values });
        keptIds.add(match.id);
      } else {
        const created = await tx.productVariant.create({
          data: { ...values, productId: product.id },
        });
        keptIds.add(created.id);
      }
    }
    const dropped = (existing?.variants ?? []).filter((v) => !keptIds.has(v.id)).map((v) => v.id);
    if (dropped.length) {
      const ordered = await tx.orderItem.findMany({
        where: { variantId: { in: dropped } },
        select: { variantId: true },
        distinct: ["variantId"],
      });
      const orderedIds = new Set(ordered.map((o) => o.variantId));
      const deletable = dropped.filter((d) => !orderedIds.has(d));
      if (deletable.length)
        await tx.productVariant.deleteMany({ where: { id: { in: deletable } } });
      if (orderedIds.size) {
        await tx.productVariant.updateMany({
          where: { id: { in: [...orderedIds].filter((x): x is string => Boolean(x)) } },
          data: { isActive: false, isDefault: false },
        });
      }
    }

    // Images: replace the list in the given order.
    const incomingUrls = new Set(data.images.map((i) => i.url));
    for (const img of existing?.images ?? []) {
      if (img.publicId && !incomingUrls.has(img.url)) removedPublicIds.push(img.publicId);
    }
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (data.images.length) {
      await tx.productImage.createMany({
        data: data.images.map((img, index) => ({
          productId: product.id,
          url: img.url,
          publicId: img.publicId,
          alt: json(img.alt),
          width: img.width,
          height: img.height,
          sortOrder: index,
        })),
      });
    }

    await audit(
      {
        actorId,
        action: existing ? "product.update" : "product.create",
        entityType: "Product",
        entityId: product.id,
        changes: {
          ...(existing
            ? diff(existing as unknown as Record<string, unknown>, {
                slug,
                name: data.name,
                status: data.status,
                categoryId: data.categoryId,
                brand: data.brand,
                isFeatured: data.isFeatured,
              })
            : { slug, name: data.name, status: data.status }),
          variants: data.variants.length,
          images: data.images.length,
        } as Prisma.InputJsonValue,
      },
      tx,
    );
    return { ok: true, id: product.id, slug };
  }
}

export async function saveProduct(
  id: string | null,
  data: ProductFormData,
  actorId: string,
): Promise<SaveProductResult> {
  const removedPublicIds: string[] = [];
  const result = await db.$transaction(
    (tx) => saveProductInTx(tx, id, data, actorId, removedPublicIds),
    {
      timeout: 20_000,
    },
  );

  // Best effort: remove files no longer used (after the transaction committed).
  if (result.ok && removedPublicIds.length) {
    const storage = getStorageProvider();
    await Promise.allSettled(removedPublicIds.map((pid) => storage.delete(pid)));
  }
  return result;
}

/** Bulk status change (publish, unpublish, archive). */
export async function setProductsStatus(ids: string[], status: ProductStatus, actorId: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.product.updateMany({ where: { id: { in: ids } }, data: { status } });
    if (status === "PUBLISHED") {
      await tx.product.updateMany({
        where: { id: { in: ids }, publishedAt: null },
        data: { publishedAt: new Date() },
      });
    }
    await audit(
      {
        actorId,
        action: "product.bulk_status",
        entityType: "Product",
        changes: { ids, status, count },
      },
      tx,
    );
    return count;
  });
}
