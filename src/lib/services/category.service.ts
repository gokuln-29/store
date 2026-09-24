import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import type { CategoryFormData } from "@/lib/validators/catalog-forms";
import { audit, diff } from "./audit.service";

export type CategoryListItem = {
  id: string;
  slug: string;
  name: Prisma.JsonValue;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  imageUrl: string | null;
  depth: number;
  productCount: number;
  childCount: number;
  attributeCount: number;
};

/** All categories in tree order (parents before children), with depth for indentation. */
export async function listCategoryTree(): Promise<CategoryListItem[]> {
  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { products: true, children: true, attributes: true } } },
  });
  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  const out: CategoryListItem[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const row of byParent.get(parentId) ?? []) {
      out.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        parentId: row.parentId,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        imageUrl: row.imageUrl,
        depth,
        productCount: row._count.products,
        childCount: row._count.children,
        attributeCount: row._count.attributes,
      });
      visit(row.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

export function getCategory(id: string) {
  return db.category.findUnique({
    where: { id },
    include: { attributes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}

/** Categories with their attribute definitions, for the product form. */
export function listCategoriesWithAttributes() {
  return db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      parentId: true,
      taxRateBps: true,
      attributes: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          key: true,
          label: true,
          type: true,
          options: true,
          unit: true,
          isRequired: true,
        },
      },
    },
  });
}

export type SaveCategoryError = "not_found" | "slug_taken" | "parent_invalid";
export type SaveCategoryResult =
  | { ok: true; id: string }
  | { ok: false; error: SaveCategoryError; fieldErrors?: Record<string, string> };

type Tx = Prisma.TransactionClient;

/** True if `candidateParent` is `id` itself or one of its descendants. */
async function createsCycle(tx: Tx, id: string, candidateParent: string): Promise<boolean> {
  let current: string | null = candidateParent;
  for (let guard = 0; current && guard < 100; guard++) {
    if (current === id) return true;
    const row: { parentId: string | null } | null = await tx.category.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return false;
}

export async function saveCategory(
  id: string | null,
  data: CategoryFormData,
  actorId: string,
): Promise<SaveCategoryResult> {
  return db.$transaction(async (tx): Promise<SaveCategoryResult> => {
    const existing = id
      ? await tx.category.findUnique({ where: { id }, include: { attributes: true } })
      : null;
    if (id && !existing) return { ok: false, error: "not_found" };

    if (data.parentId) {
      const parent = await tx.category.findUnique({
        where: { id: data.parentId },
        select: { id: true },
      });
      if (!parent || (id && (await createsCycle(tx, id, data.parentId)))) {
        return { ok: false, error: "parent_invalid", fieldErrors: { parentId: "parentInvalid" } };
      }
    }

    const slugTaken = async (slug: string) =>
      Boolean(
        await tx.category.findFirst({
          where: { slug, ...(id ? { NOT: { id } } : {}) },
          select: { id: true },
        }),
      );
    let slug: string;
    if (data.slug) {
      if (await slugTaken(data.slug))
        return { ok: false, error: "slug_taken", fieldErrors: { slug: "slugTaken" } };
      slug = data.slug;
    } else {
      slug =
        existing?.slug ?? (await uniqueSlug(slugify(data.name.en ?? "", "category"), slugTaken));
    }

    const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));
    const fields = {
      slug,
      name: data.name as Prisma.InputJsonValue,
      description: json(data.description),
      parentId: data.parentId,
      imageUrl: data.imageUrl,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      taxRateBps: data.taxRateBps,
      hsnCode: data.hsnCode,
      metaTitle: json(data.metaTitle),
      metaDescription: json(data.metaDescription),
    };
    const category = existing
      ? await tx.category.update({ where: { id: existing.id }, data: fields })
      : await tx.category.create({ data: fields });

    // Attribute definitions: update by id (key never changes), create new, delete removed.
    const current = existing?.attributes ?? [];
    const keep = new Set<string>();
    for (const [index, attr] of data.attributes.entries()) {
      const values = {
        label: attr.label as Prisma.InputJsonValue,
        type: attr.type,
        options: json(attr.options),
        unit: attr.unit,
        isRequired: attr.isRequired,
        isFilterable: attr.isFilterable,
        sortOrder: index,
      };
      const match = attr.id ? current.find((c) => c.id === attr.id) : undefined;
      if (match) {
        keep.add(match.id);
        await tx.attributeDefinition.update({ where: { id: match.id }, data: values });
      } else {
        // New row; if a definition with this key already exists it is reused.
        const created = await tx.attributeDefinition.upsert({
          where: { categoryId_key: { categoryId: category.id, key: attr.key } },
          create: { ...values, key: attr.key, categoryId: category.id },
          update: values,
        });
        keep.add(created.id);
      }
    }
    const removed = current.filter((c) => !keep.has(c.id));
    if (removed.length)
      await tx.attributeDefinition.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });

    await audit(
      {
        actorId,
        action: existing ? "category.update" : "category.create",
        entityType: "Category",
        entityId: category.id,
        changes: {
          ...(existing
            ? diff(existing as unknown as Record<string, unknown>, fields)
            : { slug, name: data.name }),
          attributes: { kept: keep.size, removed: removed.map((r) => r.key) },
        } as Prisma.InputJsonValue,
      },
      tx,
    );
    return { ok: true, id: category.id };
  });
}

export type DeleteCategoryResult =
  { ok: true } | { ok: false; error: "not_found" | "has_products" | "has_children" };

/** Only empty categories can be deleted, so products are never orphaned. */
export async function deleteCategory(id: string, actorId: string): Promise<DeleteCategoryResult> {
  return db.$transaction(async (tx): Promise<DeleteCategoryResult> => {
    const category = await tx.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) return { ok: false, error: "not_found" };
    if (category._count.products > 0) return { ok: false, error: "has_products" };
    if (category._count.children > 0) return { ok: false, error: "has_children" };
    await tx.category.delete({ where: { id } });
    await audit(
      {
        actorId,
        action: "category.delete",
        entityType: "Category",
        entityId: id,
        changes: { slug: category.slug },
      },
      tx,
    );
    return { ok: true };
  });
}
