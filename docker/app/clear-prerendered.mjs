// Runs before the server starts (see docker/app/entrypoint.sh).
//
// The Docker image is built against an empty throwaway database, so pages that Next.js
// prerendered at build time (home, cart, wishlist, offline, not-found, sitemap) contain no store
// data. Deleting them makes each page render from the real database on its first request; the
// result is cached as usual after that.
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const nextDir = path.resolve(process.argv[2] ?? ".next");
const manifestPath = path.join(nextDir, "prerender-manifest.json");
if (!existsSync(manifestPath)) process.exit(0);

// Build artefacts that never read store data.
const KEEP = new Set(["/_global-error", "/favicon.ico", "/robots.txt"]);
const appDir = path.join(nextDir, "server", "app");
const { routes } = JSON.parse(readFileSync(manifestPath, "utf8"));

let cleared = 0;
for (const route of Object.keys(routes)) {
  if (KEEP.has(route) || route.startsWith("/serwist/")) continue;
  const base = path.join(appDir, route === "/" ? "index" : route);
  for (const suffix of [".html", ".rsc", ".meta", ".body", ".segments"]) {
    const file = base + suffix;
    if (existsSync(file)) rmSync(file, { recursive: true, force: true });
  }
  cleared += 1;
}
console.log(
  JSON.stringify({ level: "info", scope: "startup", msg: "cleared prerendered pages", cleared }),
);
