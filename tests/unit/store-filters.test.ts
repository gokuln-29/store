import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  listingQuery,
  parseListingParams,
  type FilterableAttribute,
} from "@/lib/utils/store-filters";

const attrs: FilterableAttribute[] = [
  { key: "material", type: "SELECT", options: [{ value: "cotton" }, { value: "silk" }] },
  { key: "warranty_months", type: "NUMBER", options: null },
];

describe("store filters", () => {
  it("parses a full query", () => {
    const p = parseListingParams(
      {
        sort: "price_asc",
        page: "2",
        min: "100",
        max: "999.50",
        stock: "1",
        "f.material": "silk,cotton,silk",
        "f.warranty_months": "6-12",
      },
      attrs,
    );
    expect(p).toEqual({
      sort: "price_asc",
      page: 2,
      minPrice: 10000,
      maxPrice: 99950,
      inStock: true,
      attributes: {
        material: { kind: "values", values: ["silk", "cotton"] },
        warranty_months: { kind: "range", min: 6, max: 12 },
      },
    });
    expect(activeFilterCount(p)).toBe(4);
  });

  it("ignores unknown or unsafe values", () => {
    const p = parseListingParams(
      {
        sort: "drop table",
        page: "-4",
        min: "abc",
        "f.material": "wool",
        "f.color": "red",
        "f.warranty_months": "x-y",
      },
      attrs,
    );
    expect(p).toEqual({
      sort: "newest",
      page: 1,
      minPrice: null,
      maxPrice: null,
      inStock: false,
      attributes: {},
    });
  });

  it("only allows relevance on search pages and swaps inverted price ranges", () => {
    expect(parseListingParams({ sort: "relevance" }, []).sort).toBe("newest");
    expect(parseListingParams({ sort: "relevance" }, [], { allowRelevance: true }).sort).toBe(
      "relevance",
    );
    expect(parseListingParams({ min: "900", max: "100" }, [])).toMatchObject({
      minPrice: 10000,
      maxPrice: 90000,
    });
  });

  it("serializes back to a stable query string", () => {
    const p = parseListingParams(
      { "f.material": "silk", "f.warranty_months": "-12", min: "100", page: "3" },
      attrs,
    );
    expect(listingQuery(p)).toBe("?min=100&f.material=silk&f.warranty_months=-12&page=3");
    expect(listingQuery({ ...p, page: 1, sort: "newest" })).toBe(
      "?min=100&f.material=silk&f.warranty_months=-12",
    );
    expect(listingQuery({ q: "tea", sort: "relevance" }, { sort: "relevance" })).toBe("?q=tea");
  });
});
