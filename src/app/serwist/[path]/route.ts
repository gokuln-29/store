import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

// New offline pages with every build (this route is rendered once, at build time).
const revision = randomUUID();

/** Serves the service worker (/serwist/sw.js), bundled from src/sw/sw.ts. */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/sw/sw.ts",
    useNativeEsbuild: true,
    // Big chunks (e.g. the admin rich-text editor) aren't needed by shoppers up front; they are
    // still cached at runtime the first time they're used.
    maximumFileSizeToCacheInBytes: 250 * 1024,
    additionalPrecacheEntries: ["en", "ta", "kn"].map((locale) => ({
      url: `/${locale}/offline`,
      revision,
    })),
  },
);
