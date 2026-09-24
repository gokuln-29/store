import { z } from "zod";
import { HEX_COLOR } from "@/lib/utils/color";
import { toKey } from "@/lib/utils/slug";
import { attributeKeySchema, attributeTypeSchema, slugSchema } from "./catalog";
import {
  intFromString,
  optionalIntFromString,
  optionalLocalizedSchema,
  optionalRupeesSchema,
  optionalText,
  percentToBpsSchema,
  requiredLocalizedSchema,
  rupeesSchema,
  urlOrPathSchema,
} from "./common";

// Messages are keys in the "Errors" namespace.

const optionalSlug = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || slugSchema.safeParse(v).success, "slugInvalid")
  .transform((v) => v || null);

const optionalId = z
  .string()
  .trim()
  .max(64)
  .transform((v) => v || null);

const optionalPercent = z.string().transform((value, ctx) => {
  if (!value.trim()) return null;
  const parsed = percentToBpsSchema.safeParse(value);
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "percentInvalid" });
    return z.NEVER;
  }
  return parsed.data;
});

const hsnSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4,8}$/.test(v), "hsnInvalid")
  .transform((v) => v || null);

const choiceInput = z.object({
  value: z.string().trim().min(1, "required").max(60, "tooLong"),
  label: optionalLocalizedSchema,
});

// ───────────── Category ─────────────

export const attributeInputSchema = z
  .object({
    id: optionalId,
    key: z.string().trim().max(40, "tooLong"),
    label: requiredLocalizedSchema("en"),
    type: attributeTypeSchema,
    unit: optionalText(20),
    isRequired: z.boolean(),
    isFilterable: z.boolean(),
    options: z.array(choiceInput).max(100, "tooMany"),
  })
  .transform((attr, ctx) => {
    const key = attr.key ? attr.key.toLowerCase() : toKey(attr.label.en ?? "", "attribute");
    if (!attributeKeySchema.safeParse(key).success) {
      ctx.addIssue({ code: "custom", path: ["key"], message: "keyInvalid" });
      return z.NEVER;
    }
    const usesOptions = attr.type === "SELECT" || attr.type === "COLOR";
    const options = usesOptions
      ? attr.options.map((o) => ({ value: o.value, label: o.label ?? { en: o.value } }))
      : [];
    if (attr.type === "SELECT" && options.length === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "optionsRequired" });
    }
    options.forEach((o, i) => {
      if (attr.type === "COLOR" && !HEX_COLOR.test(o.value)) {
        ctx.addIssue({ code: "custom", path: ["options", i, "value"], message: "colorInvalid" });
      }
    });
    if (new Set(options.map((o) => o.value)).size !== options.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "duplicateValues" });
    }
    return {
      ...attr,
      key,
      options: options.length ? options : null,
      unit: attr.type === "NUMBER" ? attr.unit : null,
    };
  });

export const categoryFormSchema = z
  .object({
    name: requiredLocalizedSchema("en"),
    description: optionalLocalizedSchema,
    slug: optionalSlug,
    parentId: optionalId,
    imageUrl: urlOrPathSchema,
    sortOrder: intFromString({ min: -10_000, max: 10_000 }),
    isActive: z.boolean(),
    taxRateBps: optionalPercent,
    hsnCode: hsnSchema,
    metaTitle: optionalLocalizedSchema,
    metaDescription: optionalLocalizedSchema,
    attributes: z.array(attributeInputSchema).max(50, "tooMany"),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.attributes.forEach((a, i) => {
      if (seen.has(a.key))
        ctx.addIssue({ code: "custom", path: ["attributes", i, "key"], message: "duplicateKey" });
      seen.add(a.key);
    });
  });

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormData = z.output<typeof categoryFormSchema>;

// ───────────── Product ─────────────

export const productOptionInputSchema = z
  .object({
    key: z.string().trim().max(40, "tooLong"),
    label: requiredLocalizedSchema("en"),
    values: z.array(choiceInput).min(1, "optionsRequired").max(50, "tooMany"),
  })
  .transform((opt, ctx) => {
    const key = opt.key ? opt.key.toLowerCase() : toKey(opt.label.en ?? "", "option");
    if (!attributeKeySchema.safeParse(key).success) {
      ctx.addIssue({ code: "custom", path: ["key"], message: "keyInvalid" });
      return z.NEVER;
    }
    if (new Set(opt.values.map((v) => v.value)).size !== opt.values.length) {
      ctx.addIssue({ code: "custom", path: ["values"], message: "duplicateValues" });
    }
    return {
      key,
      label: opt.label,
      values: opt.values.map((v) => ({ value: v.value, label: v.label ?? { en: v.value } })),
    };
  });

export const variantInputSchema = z
  .object({
    id: optionalId,
    optionValues: z.record(z.string(), z.string()),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-_]{1,63}$/, "skuInvalid"),
    price: rupeesSchema,
    compareAtPrice: optionalRupeesSchema,
    costPrice: optionalRupeesSchema,
    stock: intFromString({ min: 0, max: 10_000_000 }),
    lowStockThreshold: intFromString({ min: 0, max: 1_000_000 }),
    weightGrams: optionalIntFromString({ min: 1, max: 1_000_000 }),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtPrice != null && v.compareAtPrice < v.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "mrpBelowPrice" });
    }
  });

export const productImageInputSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  publicId: optionalText(500),
  alt: optionalLocalizedSchema,
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const productFormSchema = z
  .object({
    name: requiredLocalizedSchema("en"),
    shortDescription: optionalLocalizedSchema,
    /** Rich text HTML per locale; sanitized on the server. */
    description: optionalLocalizedSchema,
    slug: optionalSlug,
    categoryId: z.string().trim().min(1, "required"),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    brand: optionalText(80),
    isFeatured: z.boolean(),
    /** Raw attribute inputs keyed by definition key; typed and checked against the category on the server. */
    attributes: z.record(z.string(), z.string()),
    options: z.array(productOptionInputSchema).max(3, "tooManyOptions"),
    variants: z.array(variantInputSchema).min(1, "variantRequired").max(500, "tooMany"),
    images: z.array(productImageInputSchema).max(20, "tooMany"),
    taxRateBps: optionalPercent,
    hsnCode: hsnSchema,
    metaTitle: optionalLocalizedSchema,
    metaDescription: optionalLocalizedSchema,
  })
  .superRefine((v, ctx) => {
    const keys = v.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "duplicateKey" });
    }
    const skus = new Set<string>();
    v.variants.forEach((variant, i) => {
      if (skus.has(variant.sku)) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "skuDuplicate" });
      }
      skus.add(variant.sku);
      const valid = v.options.every((o) =>
        o.values.some((val) => val.value === variant.optionValues[o.key]),
      );
      const extra = Object.keys(variant.optionValues).some((k) => !keys.includes(k));
      if (!valid || extra) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "optionValues"],
          message: "variantMismatch",
        });
      }
    });
    if (v.options.length === 0 && v.variants.length > 1) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "variantMismatch" });
    }
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;
