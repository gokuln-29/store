import type { Choice } from "@/lib/validators/catalog";
import type { CategoryFormInput } from "@/lib/validators/catalog-forms";
import { localize } from "./localized";

type Localized = Record<string, string>;

/** Converts a stored localized JSON value into form input (all locales as strings). */
export function toLocalizedInput(value: unknown): Localized {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === "string",
    ),
  );
}

/** Category row from the DB -> category form defaults. */
export function categoryToFormInput(category: {
  name: unknown;
  description: unknown;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  taxRateBps: number | null;
  hsnCode: string | null;
  metaTitle: unknown;
  metaDescription: unknown;
  attributes: {
    id: string;
    key: string;
    label: unknown;
    type: "TEXT" | "NUMBER" | "SELECT" | "COLOR";
    unit: string | null;
    isRequired: boolean;
    isFilterable: boolean;
    options: unknown;
  }[];
}): CategoryFormInput {
  return {
    name: toLocalizedInput(category.name),
    description: toLocalizedInput(category.description),
    slug: category.slug,
    parentId: category.parentId ?? "",
    imageUrl: category.imageUrl ?? "",
    sortOrder: String(category.sortOrder),
    isActive: category.isActive,
    taxRateBps: category.taxRateBps == null ? "" : String(category.taxRateBps / 100),
    hsnCode: category.hsnCode ?? "",
    metaTitle: toLocalizedInput(category.metaTitle),
    metaDescription: toLocalizedInput(category.metaDescription),
    attributes: category.attributes.map((a) => ({
      id: a.id,
      key: a.key,
      label: toLocalizedInput(a.label),
      type: a.type,
      unit: a.unit ?? "",
      isRequired: a.isRequired,
      isFilterable: a.isFilterable,
      options: ((a.options as Choice[] | null) ?? []).map((o) => ({
        value: o.value,
        label: toLocalizedInput(o.label),
      })),
    })),
  };
}

export function localizedLabel(value: unknown, locale: string) {
  return localize(value, locale, "en");
}

/** Categories (flat, with attributes) -> tree-ordered choices for the product form. */
export function categoryChoices<
  C extends { id: string; parentId: string | null; name: unknown; attributes: unknown[] },
>(categories: C[]): (C & { depth: number })[] {
  const byParent = new Map<string | null, C[]>();
  for (const c of categories) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const out: (C & { depth: number })[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      out.push({ ...c, depth });
      visit(c.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

const paise = (v: number | null) =>
  v == null ? "" : v % 100 === 0 ? String(v / 100) : (v / 100).toFixed(2);

/** Product from the DB -> product form defaults. */
export function productToFormInput(product: {
  name: unknown;
  shortDescription: unknown;
  description: unknown;
  slug: string;
  categoryId: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  brand: string | null;
  isFeatured: boolean;
  attributes: unknown;
  options: unknown;
  taxRateBps: number | null;
  hsnCode: string | null;
  metaTitle: unknown;
  metaDescription: unknown;
  variants: {
    id: string;
    optionValues: unknown;
    sku: string;
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
    stock: number;
    lowStockThreshold: number;
    weightGrams: number | null;
    isActive: boolean;
  }[];
  images: {
    url: string;
    publicId: string | null;
    alt: unknown;
    width: number | null;
    height: number | null;
  }[];
}): import("@/lib/validators/catalog-forms").ProductFormInput {
  const options =
    (product.options as {
      key: string;
      label: unknown;
      values: { value: string; label: unknown }[];
    }[]) ?? [];
  const optionKeys = options.map((o) => o.key);
  return {
    name: toLocalizedInput(product.name),
    shortDescription: toLocalizedInput(product.shortDescription),
    description: toLocalizedInput(product.description),
    slug: product.slug,
    categoryId: product.categoryId,
    status: product.status,
    brand: product.brand ?? "",
    isFeatured: product.isFeatured,
    attributes: Object.fromEntries(
      Object.entries((product.attributes as Record<string, unknown>) ?? {}).map(([k, v]) => [
        k,
        String(v),
      ]),
    ),
    options: options.map((o) => ({
      key: o.key,
      label: toLocalizedInput(o.label),
      values: o.values.map((v) => ({ value: v.value, label: toLocalizedInput(v.label) })),
    })),
    // Inactive variants whose options no longer exist are left out of the form.
    variants: product.variants
      .filter((v) => {
        const values = (v.optionValues as Record<string, string>) ?? {};
        return (
          Object.keys(values).length === optionKeys.length && optionKeys.every((k) => k in values)
        );
      })
      .map((v) => ({
        id: v.id,
        optionValues: (v.optionValues as Record<string, string>) ?? {},
        sku: v.sku,
        price: paise(v.price),
        compareAtPrice: paise(v.compareAtPrice),
        costPrice: paise(v.costPrice),
        stock: String(v.stock),
        lowStockThreshold: String(v.lowStockThreshold),
        weightGrams: v.weightGrams == null ? "" : String(v.weightGrams),
        isActive: v.isActive,
      })),
    images: product.images.map((i) => ({
      url: i.url,
      publicId: i.publicId ?? "",
      alt: toLocalizedInput(i.alt),
      width: i.width,
      height: i.height,
    })),
    taxRateBps: product.taxRateBps == null ? "" : String(product.taxRateBps / 100),
    hsnCode: product.hsnCode ?? "",
    metaTitle: toLocalizedInput(product.metaTitle),
    metaDescription: toLocalizedInput(product.metaDescription),
  };
}

/** Prepares categories (with attribute definitions from the DB) for the product form. */
export function toProductFormCategories(
  categories: {
    id: string;
    name: unknown;
    parentId: string | null;
    attributes: {
      id: string;
      key: string;
      label: unknown;
      type: "TEXT" | "NUMBER" | "SELECT" | "COLOR";
      options: unknown;
      unit: string | null;
      isRequired: boolean;
    }[];
  }[],
) {
  return categoryChoices(categories).map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    depth: c.depth,
    attributes: c.attributes.map((a) => ({
      ...a,
      options: Array.isArray(a.options) ? (a.options as { value: string; label: unknown }[]) : null,
    })),
  }));
}
