import { z } from "zod";
import { localizedTextSchema } from "./localized";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** snake_case key used in JSON, e.g. "material", "shelf_life_days". */
export const attributeKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "Use lowercase letters, numbers and underscores");

export const attributeTypeSchema = z.enum(["TEXT", "NUMBER", "SELECT", "COLOR"]);
export type AttributeTypeValue = z.infer<typeof attributeTypeSchema>;

export const choiceSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: localizedTextSchema,
});
export type Choice = z.infer<typeof choiceSchema>;

const choicesSchema = z
  .array(choiceSchema)
  .min(1)
  .refine((items) => new Set(items.map((i) => i.value)).size === items.length, {
    message: "Option values must be unique",
  });

/** Input for creating/updating an AttributeDefinition. */
export const attributeDefinitionSchema = z
  .object({
    key: attributeKeySchema,
    label: localizedTextSchema,
    type: attributeTypeSchema,
    options: choicesSchema.nullish(),
    unit: z.string().trim().max(20).nullish(),
    isRequired: z.boolean().default(false),
    isFilterable: z.boolean().default(false),
    sortOrder: z.int().default(0),
  })
  .superRefine((def, ctx) => {
    if (def.type === "SELECT" && !def.options?.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Select needs options" });
    }
    if (def.type === "COLOR" && def.options?.some((o) => !HEX_COLOR.test(o.value))) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Color values must be #RRGGBB" });
    }
    if ((def.type === "TEXT" || def.type === "NUMBER") && def.options?.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Only select/color use options" });
    }
  });
export type AttributeDefinitionInput = z.infer<typeof attributeDefinitionSchema>;

/** The subset of an AttributeDefinition needed to validate product values. */
export type AttributeDefinitionLike = {
  key: string;
  type: AttributeTypeValue;
  isRequired: boolean;
  options?: Choice[] | null;
};

/** Stored shape of Product.attributes. */
export type ProductAttributes = Record<string, string | number>;

function valueSchemaFor(def: AttributeDefinitionLike): z.ZodType<string | number> {
  switch (def.type) {
    case "TEXT":
      return z.string().trim().min(1).max(2000);
    case "NUMBER":
      return z.number().finite();
    case "SELECT":
    case "COLOR": {
      const values = (def.options ?? []).map((o) => o.value);
      if (values.length > 0) return z.enum(values as [string, ...string[]]);
      // COLOR with no preset palette accepts any hex color.
      return def.type === "COLOR" ? z.string().regex(HEX_COLOR) : z.never();
    }
  }
}

/**
 * Builds a strict schema for Product.attributes from its category's definitions.
 * Unknown keys are rejected so typos never reach the database.
 */
export function productAttributesSchema(defs: readonly AttributeDefinitionLike[]) {
  const shape: Record<string, z.ZodType<string | number | undefined>> = {};
  for (const def of defs) {
    const schema = valueSchemaFor(def);
    shape[def.key] = def.isRequired ? schema : schema.optional();
  }
  // Drop unset optional keys so the stored JSON only contains real values.
  return z
    .strictObject(shape)
    .transform((values): ProductAttributes =>
      Object.fromEntries(
        Object.entries(values).filter(
          (entry): entry is [string, string | number] => entry[1] !== undefined,
        ),
      ),
    );
}

/** Variant axes stored in Product.options. */
export const productOptionsSchema = z
  .array(
    z.object({
      key: attributeKeySchema,
      label: localizedTextSchema,
      values: choicesSchema,
    }),
  )
  .max(3)
  .refine((opts) => new Set(opts.map((o) => o.key)).size === opts.length, {
    message: "Option keys must be unique",
  });
export type ProductOptions = z.infer<typeof productOptionsSchema>;

/**
 * Validates ProductVariant.optionValues against the product's options:
 * every axis must be set to one of its allowed values, nothing extra.
 */
export function variantOptionValuesSchema(options: ProductOptions) {
  const shape: Record<string, z.ZodType> = {};
  for (const option of options) {
    shape[option.key] = z.enum(option.values.map((v) => v.value) as [string, ...string[]]);
  }
  return z.strictObject(shape);
}

export const money = z.int().nonnegative(); // paise

export const productVariantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .regex(/^[A-Z0-9][A-Z0-9-_]{1,63}$/, "Use uppercase letters, numbers, - and _"),
    optionValues: z.record(z.string(), z.string()).default({}),
    price: money,
    compareAtPrice: money.nullish(),
    costPrice: money.nullish(),
    stock: z.int().nonnegative(),
    lowStockThreshold: z.int().nonnegative().default(5),
    weightGrams: z.int().positive().nullish(),
    isDefault: z.boolean().default(false),
  })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice >= v.price, {
    message: "MRP must be greater than or equal to the price",
    path: ["compareAtPrice"],
  });
export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .max(120);
