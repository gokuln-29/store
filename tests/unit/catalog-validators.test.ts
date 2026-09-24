import { describe, expect, it } from "vitest";
import {
  attributeDefinitionSchema,
  productAttributesSchema,
  productOptionsSchema,
  productVariantSchema,
  variantOptionValuesSchema,
  type AttributeDefinitionLike,
} from "@/lib/validators/catalog";
import { localizedTextRequiring, localizedTextSchema } from "@/lib/validators/localized";

describe("localizedTextSchema", () => {
  it("accepts partial translations", () => {
    expect(localizedTextSchema.safeParse({ en: "Shirt", ta: "சட்டை" }).success).toBe(true);
  });

  it("rejects empty text and unknown locales", () => {
    expect(localizedTextSchema.safeParse({}).success).toBe(false);
    expect(localizedTextSchema.safeParse({ en: "  " }).success).toBe(false);
    expect(localizedTextSchema.safeParse({ fr: "Chemise" }).success).toBe(false);
  });

  it("can require a specific locale", () => {
    expect(localizedTextRequiring("en").safeParse({ ta: "சட்டை" }).success).toBe(false);
    expect(localizedTextRequiring("ta").safeParse({ ta: "சட்டை" }).success).toBe(true);
  });
});

describe("attributeDefinitionSchema", () => {
  it("requires options for SELECT", () => {
    const result = attributeDefinitionSchema.safeParse({
      key: "material",
      label: { en: "Material" },
      type: "SELECT",
    });
    expect(result.success).toBe(false);
  });

  it("requires hex values for COLOR options", () => {
    const bad = attributeDefinitionSchema.safeParse({
      key: "color",
      label: { en: "Color" },
      type: "COLOR",
      options: [{ value: "red", label: { en: "Red" } }],
    });
    expect(bad.success).toBe(false);
  });

  it("rejects invalid keys", () => {
    const result = attributeDefinitionSchema.safeParse({
      key: "Shelf Life",
      label: { en: "Shelf life" },
      type: "NUMBER",
    });
    expect(result.success).toBe(false);
  });
});

describe("productAttributesSchema", () => {
  const defs: AttributeDefinitionLike[] = [
    {
      key: "material",
      type: "SELECT",
      isRequired: true,
      options: [
        { value: "cotton", label: { en: "Cotton" } },
        { value: "silk", label: { en: "Silk" } },
      ],
    },
    { key: "shelf_life_days", type: "NUMBER", isRequired: false },
    { key: "care", type: "TEXT", isRequired: false },
    { key: "color", type: "COLOR", isRequired: false },
  ];
  const schema = productAttributesSchema(defs);

  it("accepts valid values", () => {
    expect(
      schema.safeParse({ material: "cotton", shelf_life_days: 30, color: "#112233" }).success,
    ).toBe(true);
  });

  it("rejects missing required, wrong types, unknown options and unknown keys", () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ material: "wool" }).success).toBe(false);
    expect(schema.safeParse({ material: "cotton", shelf_life_days: "30" }).success).toBe(false);
    expect(schema.safeParse({ material: "cotton", color: "blue" }).success).toBe(false);
    expect(schema.safeParse({ material: "cotton", matrial: "x" }).success).toBe(false);
  });
});

describe("product options and variants", () => {
  const options = productOptionsSchema.parse([
    {
      key: "size",
      label: { en: "Size" },
      values: [
        { value: "S", label: { en: "S" } },
        { value: "M", label: { en: "M" } },
      ],
    },
  ]);

  it("rejects duplicate option values", () => {
    const result = productOptionsSchema.safeParse([
      {
        key: "size",
        label: { en: "Size" },
        values: [
          { value: "S", label: { en: "S" } },
          { value: "S", label: { en: "Small" } },
        ],
      },
    ]);
    expect(result.success).toBe(false);
  });

  it("validates variant option values against the product options", () => {
    const schema = variantOptionValuesSchema(options);
    expect(schema.safeParse({ size: "M" }).success).toBe(true);
    expect(schema.safeParse({ size: "XL" }).success).toBe(false);
    expect(schema.safeParse({ size: "M", color: "red" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("requires integer paise, non-negative stock and MRP >= price", () => {
    const base = { sku: "TSHIRT-M", price: 49900, stock: 10 };
    expect(productVariantSchema.safeParse(base).success).toBe(true);
    expect(productVariantSchema.safeParse({ ...base, price: 499.5 }).success).toBe(false);
    expect(productVariantSchema.safeParse({ ...base, stock: -1 }).success).toBe(false);
    expect(productVariantSchema.safeParse({ ...base, compareAtPrice: 39900 }).success).toBe(false);
    expect(productVariantSchema.safeParse({ ...base, sku: "tshirt m" }).success).toBe(false);
  });
});
