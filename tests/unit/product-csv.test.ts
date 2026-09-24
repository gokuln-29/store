import { describe, expect, it } from "vitest";
import {
  buildProductInput,
  escapeCell,
  groupByHandle,
  locateError,
  parseProductCsv,
  productsToCsv,
} from "@/lib/services/product-csv";

const HEADER =
  "handle,name_en,name_ta,category,status,option1_name,option1_value,sku,price,mrp,stock,attr:material,image_urls";

describe("product CSV", () => {
  it("escapes formula-like cells and round-trips them", () => {
    expect(escapeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(escapeCell("Cotton")).toBe("Cotton");
    const { rows } = parseProductCsv(`${HEADER}\ntee,'=SUM(1),,clothing,,,,TEE,1,,,,`);
    expect(rows[0]!.cells.name_en).toBe("=SUM(1)");
  });

  it("reports missing required columns", () => {
    const { errors } = parseProductCsv("handle,name_en\ntee,Tee");
    expect(errors.map((e) => e.column)).toEqual(["category", "sku", "price"]);
  });

  it("strips the BOM, lowercases headers and keeps Tamil text", () => {
    const { rows, errors } = parseProductCsv(
      `﻿Handle,NAME_EN,name_ta,category,sku,price\ntee,Tee,டீ,clothing,TEE,499`,
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      line: 2,
      cells: {
        handle: "tee",
        name_en: "Tee",
        name_ta: "டீ",
        category: "clothing",
        sku: "TEE",
        price: "499",
      },
    });
  });

  it("groups variant rows by handle and builds form input", () => {
    const csv = [
      HEADER,
      "tee,Tee,டீ,clothing,published,Size,S,tee-s,499,799,10,cotton,https://res.cloudinary.com/x/a.jpg | /uploads/products/b.jpg",
      "tee,,,,,,M,tee-m,549,,0,,",
      ",Orphan,,clothing,,,,X,1,,,,",
    ].join("\n");
    const { rows } = parseProductCsv(csv);
    const { groups, errors } = groupByHandle(rows);
    expect(errors).toEqual([{ row: 4, column: "handle", message: "required" }]);
    expect(groups).toHaveLength(1);

    const { input } = buildProductInput(groups[0]!, {
      category: { id: "cat1", attributeKeys: ["material"] },
      existing: undefined,
    });
    expect(input).toMatchObject({
      slug: "tee",
      name: { en: "Tee", ta: "டீ" },
      categoryId: "cat1",
      status: "PUBLISHED",
      attributes: { material: "cotton" },
      options: [{ key: "size", label: { en: "Size" }, values: [{ value: "S" }, { value: "M" }] }],
    });
    expect(input!.variants.map((v) => [v.sku, v.price, v.optionValues])).toEqual([
      ["TEE-S", "499", { size: "S" }],
      ["TEE-M", "549", { size: "M" }],
    ]);
    expect(input!.images.map((i) => i.url)).toEqual([
      "https://res.cloudinary.com/x/a.jpg",
      "/uploads/products/b.jpg",
    ]);
  });

  it("reports unknown categories, bad statuses and image hosts on the right row", () => {
    const { rows } = parseProductCsv(
      `${HEADER}\ntee,Tee,,nope,sold,,,T,1,,,,http://evil.example/x.jpg`,
    );
    const { groups } = groupByHandle(rows);
    const { input, errors } = buildProductInput(groups[0]!, {
      category: undefined,
      existing: undefined,
    });
    expect(input).toBeNull();
    expect(errors.map((e) => [e.row, e.column, e.message])).toEqual([
      [2, "category", "csvUnknownCategory"],
      [2, "status", "csvInvalidStatus"],
      [2, "image_urls", "csvImageHost"],
    ]);
  });

  it("maps form errors to CSV rows and columns", () => {
    const group = {
      handle: "tee",
      rows: [
        { line: 5, cells: {} },
        { line: 6, cells: {} },
      ],
    };
    expect(locateError(group, ["variants", 1, "compareAtPrice"], "mrpBelowPrice")).toEqual({
      row: 6,
      column: "mrp",
      message: "mrpBelowPrice",
    });
    expect(locateError(group, ["attributes", "material"], "required")).toEqual({
      row: 5,
      column: "attr:material",
      message: "required",
    });
    expect(locateError(group, ["name", "en"], "required")).toEqual({
      row: 5,
      column: "name_en",
      message: "required",
    });
  });

  it("exports one row per variant with product fields on the first row", () => {
    const csv = productsToCsv(
      [
        {
          slug: "tee",
          name: { en: "Tee", kn: "ಟೀ" },
          shortDescription: null,
          description: { en: "<p>Soft</p>" },
          categorySlug: "clothing",
          status: "PUBLISHED",
          brand: null,
          isFeatured: true,
          taxRateBps: 500,
          hsnCode: "6109",
          attributes: { material: "cotton" },
          options: [{ key: "size", label: { en: "Size" }, values: [] }],
          variants: [
            {
              sku: "TEE-S",
              optionValues: { size: "S" },
              price: 49900,
              compareAtPrice: null,
              costPrice: null,
              stock: 3,
              lowStockThreshold: 5,
              weightGrams: 200,
              isActive: true,
            },
            {
              sku: "TEE-M",
              optionValues: { size: "M" },
              price: 54950,
              compareAtPrice: null,
              costPrice: null,
              stock: 0,
              lowStockThreshold: 5,
              weightGrams: null,
              isActive: false,
            },
          ],
          images: [{ url: "/uploads/a.jpg" }],
        },
      ],
      ["material"],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const { rows } = parseProductCsv(csv);
    expect(rows[0]!.cells).toMatchObject({
      handle: "tee",
      name_kn: "ಟೀ",
      category: "clothing",
      status: "published",
      featured: "yes",
      tax_rate: "5",
      option1_name: "Size",
      option1_value: "S",
      price: "499",
      "attr:material": "cotton",
      image_urls: "/uploads/a.jpg",
    });
    expect(rows[1]!.cells).toMatchObject({
      handle: "tee",
      category: "",
      option1_value: "M",
      price: "549.50",
      variant_active: "no",
    });
  });
});
