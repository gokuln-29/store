import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../src");
const APP = path.join(SRC, "app");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "generated" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const calls = sourceFiles(SRC).flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/revalidatePath\(\s*"([^"]+)",\s*"(page|layout)"/g)].map(
    ([, route, type]) => ({ file: path.relative(SRC, file), route: route!, type: type! }),
  ),
);

/**
 * A revalidatePath pattern must spell the route folder exactly, route groups included
 * ("/[locale]/(store)/p/[slug]"). A pattern that matches no folder silently does nothing, which
 * once left approved reviews missing from cached product pages.
 */
describe("revalidatePath patterns", () => {
  it("are found in the source", () => {
    expect(calls.length).toBeGreaterThan(5);
  });

  it('never expire "/" (that would also expire the service worker route)', () => {
    expect(calls.filter((c) => c.route === "/")).toEqual([]);
  });

  it.each(calls)("$route ($type) in $file matches a route folder", ({ route, type }) => {
    const dir = path.join(APP, route);
    expect(existsSync(dir), `${dir} does not exist`).toBe(true);
    // "layout" covers every page below the folder; "page" needs the page file itself.
    if (type === "page")
      expect(existsSync(path.join(dir, "page.tsx")), `no page in ${route}`).toBe(true);
  });
});
