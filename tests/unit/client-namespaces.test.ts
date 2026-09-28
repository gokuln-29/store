import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORE_CLIENT_NAMESPACES } from "@/i18n/client-namespaces";

const SRC = path.resolve(import.meta.dirname, "../../src");

function clientFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory())
      return ["generated", "admin"].includes(name) ? [] : clientFiles(full);
    return /\.tsx?$/.test(name) && readFileSync(full, "utf8").startsWith('"use client"')
      ? [full]
      : [];
  });
}

describe("messages sent to storefront pages", () => {
  it("include every namespace used by storefront client components", () => {
    const used = new Map<string, string>();
    for (const file of clientFiles(SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/useTranslations\("([A-Za-z]+)"\)/g)) {
        used.set(m[1]!, path.relative(SRC, file));
      }
    }
    const missing = [...used].filter(
      ([ns]) => !(STORE_CLIENT_NAMESPACES as readonly string[]).includes(ns),
    );
    expect(missing).toEqual([]);
  });
});
