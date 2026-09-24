import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "@/lib/utils/sanitize";
import { slugify, toKey, uniqueSlug } from "@/lib/utils/slug";
import { combinations, comboKey, suggestSku, syncVariants } from "@/lib/utils/variants";

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Classic Cotton T-Shirt")).toBe("classic-cotton-t-shirt");
    expect(slugify("  Salt & Pepper!! ")).toBe("salt-and-pepper");
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });
  it("falls back when there is no Latin text", () => {
    expect(slugify("மைசூர் பாக்", "product")).toBe("product");
  });
  it("makes snake_case keys that start with a letter", () => {
    expect(toKey("Pack size")).toBe("pack_size");
    expect(toKey("500g")).toBe("option_500g");
  });
  it("finds a free slug", async () => {
    const taken = new Set(["shirt", "shirt-2"]);
    expect(await uniqueSlug("shirt", async (s) => taken.has(s))).toBe("shirt-3");
    expect(await uniqueSlug("kurta", async (s) => taken.has(s))).toBe("kurta");
  });
});

describe("sanitizeRichText", () => {
  it("keeps simple formatting", () => {
    expect(
      sanitizeRichText("<p><strong>Soft</strong> cotton</p><ul><li>Machine wash</li></ul>"),
    ).toBe("<p><strong>Soft</strong> cotton</p><ul><li>Machine wash</li></ul>");
  });
  it("removes scripts, handlers, styles and unsafe links", () => {
    const dirty =
      '<p onclick="x()" style="color:red">Hi<script>alert(1)</script><img src=x onerror=alert(1)></p><a href="javascript:alert(1)">bad</a>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toMatch(/script|onclick|onerror|style|javascript|<img/i);
    expect(clean).toContain("<p>Hi</p>");
  });
  it("forces safe link attributes", () => {
    expect(sanitizeRichText('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
  });
  it("treats an empty editor as empty", () => {
    expect(sanitizeRichText("<p></p>")).toBe("");
    expect(sanitizeRichText("<p><br></p>")).toBe("");
  });
});

describe("variants", () => {
  const options = [
    { key: "size", values: [{ value: "S" }, { value: "M" }] },
    { key: "color", values: [{ value: "black" }, { value: "white" }] },
  ];

  it("builds every combination", () => {
    expect(combinations(options)).toEqual([
      { size: "S", color: "black" },
      { size: "S", color: "white" },
      { size: "M", color: "black" },
      { size: "M", color: "white" },
    ]);
    expect(combinations([])).toEqual([{}]);
  });

  it("compares combinations independent of key order", () => {
    expect(comboKey({ a: "1", b: "2" })).toBe(comboKey({ b: "2", a: "1" }));
  });

  it("suggests clean SKUs", () => {
    expect(suggestSku("TEE", { size: "M", color: "black" })).toBe("TEE-M-BLACK");
    expect(suggestSku("COFFEE", { pack: "250 g" })).toBe("COFFEE-250-G");
  });

  it("keeps existing rows when options change", () => {
    const existing = [{ optionValues: { size: "S", color: "black" }, price: 100 }];
    const next = syncVariants(options, existing, (v) => ({ optionValues: v, price: 0 }));
    expect(next).toHaveLength(4);
    expect(next[0]).toBe(existing[0]);
    expect(next[1]!.price).toBe(0);
  });
});
