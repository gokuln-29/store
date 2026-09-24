/**
 * Product CSV format (one row per variant, Shopify style) — pure functions, no database.
 *
 * Rows with the same `handle` form one product. Product-level columns are read from the
 * product's first row. Attribute columns are named `attr:<key>` (e.g. `attr:material`).
 */
import Papa from "papaparse";
import { routing } from "@/i18n/routing";
import { productFormSchema, type ProductFormInput } from "@/lib/validators/catalog-forms";
import { paiseToRupeeInput } from "@/lib/utils/money";
import { toKey } from "@/lib/utils/slug";

const LOCALES = routing.locales;
const localized = (prefix: string) => LOCALES.map((l) => `${prefix}_${l}`);

export const CSV_COLUMNS = [
  "handle",
  ...localized("name"),
  ...localized("short_description"),
  ...localized("description"),
  "category",
  "status",
  "brand",
  "featured",
  "tax_rate",
  "hsn_code",
  "option1_name",
  "option1_value",
  "option2_name",
  "option2_value",
  "option3_name",
  "option3_value",
  "sku",
  "price",
  "mrp",
  "cost",
  "stock",
  "low_stock_at",
  "weight_g",
  "variant_active",
  "image_urls",
] as const;

export const REQUIRED_COLUMNS = ["handle", "name_en", "category", "sku", "price"] as const;
export const MAX_IMPORT_ROWS = 5000;

/** Image hosts next/image is configured for (see next.config.ts). */
const ALLOWED_IMAGE_HOSTS = new Set(["res.cloudinary.com", "picsum.photos"]);

// ───────────── Cell safety ─────────────

const FORMULA_START = /^[=+\-@\t\r]/;

/** Prevents spreadsheet apps from running cell contents as formulas (CSV injection). */
export function escapeCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

function unescapeCell(value: string): string {
  return value.length > 1 && value.startsWith("'") && FORMULA_START.test(value.slice(1))
    ? value.slice(1)
    : value;
}

// ───────────── Export ─────────────

type Json = unknown;

export type ExportProduct = {
  slug: string;
  name: Json;
  shortDescription: Json;
  description: Json;
  categorySlug: string;
  status: string;
  brand: string | null;
  isFeatured: boolean;
  taxRateBps: number | null;
  hsnCode: string | null;
  attributes: Json;
  options: Json;
  variants: {
    sku: string;
    optionValues: Json;
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
    stock: number;
    lowStockThreshold: number;
    weightGrams: number | null;
    isActive: boolean;
  }[];
  images: { url: string }[];
};

function text(value: Json, locale: string): string {
  if (!value || typeof value !== "object") return "";
  const v = (value as Record<string, unknown>)[locale];
  return typeof v === "string" ? v : "";
}

/** Builds the export CSV (UTF-8 with BOM so Excel shows Tamil/Kannada correctly). */
export function productsToCsv(products: ExportProduct[], attributeKeys: string[]): string {
  const header = [...CSV_COLUMNS, ...attributeKeys.map((k) => `attr:${k}`)];
  const rows: string[][] = [];

  for (const p of products) {
    const options = (Array.isArray(p.options) ? p.options : []) as { key: string; label: Json }[];
    const attributes = (p.attributes ?? {}) as Record<string, unknown>;
    p.variants.forEach((v, index) => {
      const first = index === 0;
      const values = (v.optionValues ?? {}) as Record<string, string>;
      const row: Record<string, string> = {
        handle: p.slug,
        category: first ? p.categorySlug : "",
        status: first ? p.status.toLowerCase() : "",
        brand: first ? (p.brand ?? "") : "",
        featured: first ? (p.isFeatured ? "yes" : "no") : "",
        tax_rate: first && p.taxRateBps != null ? String(p.taxRateBps / 100) : "",
        hsn_code: first ? (p.hsnCode ?? "") : "",
        sku: v.sku,
        price: paiseToRupeeInput(v.price),
        mrp: paiseToRupeeInput(v.compareAtPrice),
        cost: paiseToRupeeInput(v.costPrice),
        stock: String(v.stock),
        low_stock_at: String(v.lowStockThreshold),
        weight_g: v.weightGrams == null ? "" : String(v.weightGrams),
        variant_active: v.isActive ? "yes" : "no",
        image_urls: first ? p.images.map((i) => i.url).join(" | ") : "",
      };
      for (const locale of LOCALES) {
        row[`name_${locale}`] = first ? text(p.name, locale) : "";
        row[`short_description_${locale}`] = first ? text(p.shortDescription, locale) : "";
        row[`description_${locale}`] = first ? text(p.description, locale) : "";
      }
      options.slice(0, 3).forEach((o, i) => {
        row[`option${i + 1}_name`] = first ? text(o.label, "en") : "";
        row[`option${i + 1}_value`] = values[o.key] ?? "";
      });
      for (const key of attributeKeys) {
        row[`attr:${key}`] = first && attributes[key] != null ? String(attributes[key]) : "";
      }
      rows.push(header.map((h) => escapeCell(row[h] ?? "")));
    });
  }
  return `﻿${Papa.unparse({ fields: header, data: rows }, { newline: "\r\n" })}`;
}

// ───────────── Import: parsing ─────────────

export type CsvRow = { line: number; cells: Record<string, string> };
export type RowError = { row: number | null; column: string | null; message: string };

export function parseProductCsv(input: string): { rows: CsvRow[]; errors: RowError[] } {
  const parsed = Papa.parse<Record<string, string>>(input.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const errors: RowError[] = [];
  const headers = parsed.meta.fields ?? [];
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) errors.push({ row: null, column, message: "csvMissingColumn" });
  }
  if (parsed.data.length > MAX_IMPORT_ROWS)
    errors.push({ row: null, column: null, message: "csvTooManyRows" });
  for (const e of parsed.errors.slice(0, 20)) {
    errors.push({ row: e.row != null ? e.row + 2 : null, column: null, message: "csvMalformed" });
  }
  const rows = parsed.data.map((cells, i) => ({
    // Line 1 is the header, so data starts at line 2.
    line: i + 2,
    cells: Object.fromEntries(
      Object.entries(cells).map(([k, v]) => [k, unescapeCell(String(v ?? "").trim())]),
    ),
  }));
  return { rows, errors };
}

export type ProductGroup = { handle: string; rows: CsvRow[] };

/** Groups rows by handle (first appearance order). Rows without a handle are reported. */
export function groupByHandle(rows: CsvRow[]): { groups: ProductGroup[]; errors: RowError[] } {
  const map = new Map<string, CsvRow[]>();
  const errors: RowError[] = [];
  for (const row of rows) {
    const handle = (row.cells.handle ?? "").toLowerCase();
    if (!handle) {
      errors.push({ row: row.line, column: "handle", message: "required" });
      continue;
    }
    map.set(handle, [...(map.get(handle) ?? []), row]);
  }
  return { groups: [...map].map(([handle, groupRows]) => ({ handle, rows: groupRows })), errors };
}

// ───────────── Import: building form input ─────────────

export type ImportContext = {
  category: { id: string; attributeKeys: string[] } | undefined;
  existing:
    | {
        id: string;
        options: {
          key: string;
          label: Record<string, string>;
          values: { value: string; label: Record<string, string> }[];
        }[];
        variants: { id: string; sku: string }[];
        images: { url: string; publicId: string | null; alt: Record<string, string> }[];
      }
    | undefined;
};

const yes = (v: string | undefined) => ["yes", "true", "1", "y"].includes((v ?? "").toLowerCase());
const no = (v: string | undefined) => ["no", "false", "0", "n"].includes((v ?? "").toLowerCase());

function localizedFrom(cells: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(
    LOCALES.map((l) => [l, cells[`${prefix}_${l}`] ?? ""]).filter(([, v]) => v),
  );
}

function imageAllowed(url: string): boolean {
  if (url.startsWith("/uploads/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/** Turns a group of CSV rows into product form input (the same shape the admin form submits). */
export function buildProductInput(
  group: ProductGroup,
  ctx: ImportContext,
): { input: ProductFormInput | null; errors: RowError[] } {
  const first = group.rows[0]!.cells;
  const firstLine = group.rows[0]!.line;
  const errors: RowError[] = [];

  if (!ctx.category)
    errors.push({ row: firstLine, column: "category", message: "csvUnknownCategory" });

  const status = (first.status || "draft").toUpperCase();
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
    errors.push({ row: firstLine, column: "status", message: "csvInvalidStatus" });
  }

  // Options: names from the first row, values collected from every row. Existing options with
  // the same English name keep their key and translations.
  const options: ProductFormInput["options"] = [];
  for (const n of [1, 2, 3]) {
    const name = first[`option${n}_name`];
    if (!name) continue;
    const match = ctx.existing?.options.find(
      (o) => (o.label.en ?? "").toLowerCase() === name.toLowerCase(),
    );
    const values: string[] = [];
    for (const row of group.rows) {
      const value = row.cells[`option${n}_value`];
      if (value && !values.includes(value)) values.push(value);
    }
    options.push({
      key: match?.key ?? toKey(name, "option"),
      label: match ? { ...match.label, en: name } : { en: name },
      values: values.map((value) => ({
        value,
        label: match?.values.find((v) => v.value === value)?.label ?? {},
      })),
    });
  }

  const variants: ProductFormInput["variants"] = group.rows.map((row) => {
    const c = row.cells;
    const optionValues: Record<string, string> = {};
    options.forEach((o, i) => {
      optionValues[o.key] = c[`option${i + 1}_value`] ?? "";
    });
    const sku = (c.sku ?? "").toUpperCase();
    return {
      id: ctx.existing?.variants.find((v) => v.sku === sku)?.id ?? "",
      optionValues,
      sku,
      price: c.price ?? "",
      compareAtPrice: c.mrp ?? "",
      costPrice: c.cost ?? "",
      stock: c.stock || "0",
      lowStockThreshold: c.low_stock_at || "5",
      weightGrams: c.weight_g ?? "",
      isActive: !no(c.variant_active),
    };
  });

  // Images: listed on the first row; an empty/missing cell keeps the current images.
  let images: ProductFormInput["images"] = (ctx.existing?.images ?? []).map((i) => ({
    url: i.url,
    publicId: i.publicId ?? "",
    alt: i.alt,
    width: null,
    height: null,
  }));
  if (first.image_urls) {
    const urls = first.image_urls
      .split("|")
      .map((u) => u.trim())
      .filter(Boolean);
    const bad = urls.filter((u) => !imageAllowed(u));
    if (bad.length) errors.push({ row: firstLine, column: "image_urls", message: "csvImageHost" });
    images = urls.map((url) => {
      const current = ctx.existing?.images.find((i) => i.url === url);
      return {
        url,
        publicId: current?.publicId ?? "",
        alt: current?.alt ?? {},
        width: null,
        height: null,
      };
    });
  }

  const input: ProductFormInput = {
    name: localizedFrom(first, "name"),
    shortDescription: localizedFrom(first, "short_description"),
    description: localizedFrom(first, "description"),
    slug: group.handle,
    categoryId: ctx.category?.id ?? "",
    status: status as ProductFormInput["status"],
    brand: first.brand ?? "",
    isFeatured: yes(first.featured),
    attributes: Object.fromEntries(
      (ctx.category?.attributeKeys ?? []).map((k) => [k, first[`attr:${k}`] ?? ""]),
    ),
    options,
    variants,
    images,
    taxRateBps: first.tax_rate ?? "",
    hsnCode: first.hsn_code ?? "",
    metaTitle: {},
    metaDescription: {},
  };
  return { input: errors.length ? null : input, errors };
}

// ───────────── Import: error locations ─────────────

const VARIANT_COLUMNS: Record<string, string> = {
  sku: "sku",
  price: "price",
  compareAtPrice: "mrp",
  costPrice: "cost",
  stock: "stock",
  lowStockThreshold: "low_stock_at",
  weightGrams: "weight_g",
  optionValues: "option1_value",
};

const PRODUCT_COLUMNS: Record<string, string> = {
  slug: "handle",
  categoryId: "category",
  status: "status",
  brand: "brand",
  taxRateBps: "tax_rate",
  hsnCode: "hsn_code",
  options: "option1_name",
  variants: "sku",
  images: "image_urls",
};

/** Maps a form field path (e.g. ["variants", 2, "price"]) to a CSV row and column. */
export function locateError(
  group: ProductGroup,
  path: (string | number)[],
  message: string,
): RowError {
  const firstLine = group.rows[0]!.line;
  const [head, second, third] = path;
  if (head === "variants" && typeof second === "number") {
    return {
      row: group.rows[second]?.line ?? firstLine,
      column: VARIANT_COLUMNS[String(third)] ?? "sku",
      message,
    };
  }
  if (head === "attributes") return { row: firstLine, column: `attr:${String(second)}`, message };
  if (head === "name" || head === "shortDescription" || head === "description") {
    const prefix =
      head === "name" ? "name" : head === "shortDescription" ? "short_description" : "description";
    return { row: firstLine, column: `${prefix}_${String(second ?? "en")}`, message };
  }
  return { row: firstLine, column: PRODUCT_COLUMNS[String(head)] ?? String(head ?? ""), message };
}

/** Validates built input with the same schema as the admin form. */
export function validateInput(group: ProductGroup, input: ProductFormInput) {
  const parsed = productFormSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data, errors: [] as RowError[] };
  const errors = parsed.error.issues.map((issue) =>
    locateError(group, issue.path as (string | number)[], issue.message),
  );
  return { data: null, errors };
}

/** Converts service field errors ("variants.0.sku": "skuTaken") into CSV locations. */
export function fieldErrorsToRows(
  group: ProductGroup,
  fieldErrors: Record<string, string>,
): RowError[] {
  return Object.entries(fieldErrors).map(([path, message]) =>
    locateError(
      group,
      path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
      message,
    ),
  );
}
