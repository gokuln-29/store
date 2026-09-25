import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { placeholders } from "@/lib/i18n/icu";
import en from "@/messages/en.json";

describe("ICU placeholders", () => {
  it("finds arguments, including inside plural branches, but not branch text", () => {
    expect(placeholders("Hello")).toEqual([]);
    expect(placeholders("Order {number} of {total}")).toEqual(["number", "total"]);
    expect(
      placeholders("{count, plural, =0 {Send} =1 {Send to # device} other {# for {name}}}"),
    ).toEqual(["count", "name"]);
    expect(placeholders("{locale, select, en {English} other {Unknown}}")).toEqual(["locale"]);
    expect(placeholders("You're offline since {time}")).toEqual(["time"]);
    expect(placeholders("Literal '{braces}' and {real}")).toEqual(["real"]);
  });
});

describe("validation messages", () => {
  const errorKeys = new Set(Object.keys(en.Errors));
  const junk: unknown[] = [undefined, null, "", "x", 5, true, [], {}, { a: 1 }];

  it("are translation keys for every validator and every kind of bad input", async () => {
    const dir = path.resolve(import.meta.dirname, "../../src/lib/validators");
    const untranslated = new Set<string>();
    for (const file of readdirSync(dir)) {
      const mod = (await import(`@/lib/validators/${file.replace(/\.ts$/, "")}`)) as Record<
        string,
        unknown
      >;
      for (const [name, value] of Object.entries(mod)) {
        const schema = value as {
          safeParse?: (v: unknown) => { error?: { issues: { message: string }[] } };
        };
        // Only schemas (the re-exported `z` namespace also has a safeParse helper).
        if (typeof schema?.safeParse !== "function" || !Object.hasOwn(schema as object, "_zod"))
          continue;
        for (const input of junk) {
          for (const issue of schema.safeParse(input).error?.issues ?? []) {
            if (!errorKeys.has(issue.message))
              untranslated.add(`${file}:${name} → ${issue.message}`);
          }
        }
      }
    }
    expect([...untranslated]).toEqual([]);
  });
});
