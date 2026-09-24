import { describe, expect, it } from "vitest";
import { sniffImageType } from "@/lib/providers/storage/sniff";
import { contrastRatio, readableForeground } from "@/lib/utils/color";
import { parseTableParams, tableHref } from "@/lib/utils/table-params";

describe("color", () => {
  it("picks a readable foreground", () => {
    expect(readableForeground("#111827")).toBe("#ffffff");
    expect(readableForeground("#fde68a")).toBe("#0a0a0a");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});

describe("parseTableParams", () => {
  const config = {
    sortable: ["name", "createdAt"] as const,
    defaultSort: "createdAt" as const,
    filters: { status: ["ACTIVE", "INACTIVE"] },
  };

  it("uses safe defaults", () => {
    expect(parseTableParams({}, config)).toEqual({
      page: 1,
      pageSize: 20,
      q: "",
      sort: "createdAt",
      dir: "desc",
      filters: {},
    });
  });

  it("ignores unknown sort fields, bad pages and filter values", () => {
    const p = parseTableParams(
      {
        page: "-3",
        pageSize: "7",
        sort: "passwordHash",
        dir: "sideways",
        status: "HACKED",
        q: "  ravi ",
      },
      config,
    );
    expect(p).toMatchObject({
      page: 1,
      pageSize: 20,
      sort: "createdAt",
      dir: "desc",
      q: "ravi",
      filters: {},
    });
  });

  it("accepts valid params", () => {
    const p = parseTableParams(
      { page: "2", pageSize: "50", sort: "name", dir: "asc", status: "ACTIVE" },
      config,
    );
    expect(p).toMatchObject({
      page: 2,
      pageSize: 50,
      sort: "name",
      dir: "asc",
      filters: { status: "ACTIVE" },
    });
  });

  it("builds hrefs without defaults or empties", () => {
    expect(tableHref("/admin/staff", { q: "", page: 3, sort: "name" }, { page: 1 })).toBe(
      "/admin/staff?sort=name",
    );
  });
});

describe("sniffImageType", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("detects real image types from magic bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("GIF89a......"))).toBe("image/gif");
  });

  it("rejects SVG, HTML and unknown content", () => {
    expect(
      sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>")),
    ).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });
});
