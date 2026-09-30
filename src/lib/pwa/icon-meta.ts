import { createHash } from "node:crypto";

/** Icon names and versions: no image libraries, so layouts and the manifest can import it. */
export const ICONS = {
  "icon-192.png": { size: 192, kind: "any" },
  "icon-512.png": { size: 512, kind: "any" },
  "maskable-192.png": { size: 192, kind: "maskable" },
  "maskable-512.png": { size: 512, kind: "maskable" },
  "apple-touch-icon.png": { size: 180, kind: "apple" },
  "badge-96.png": { size: 96, kind: "badge" },
  // Header/footer logo: the uploaded logo is often a large PNG; this is a small copy of it.
  "logo-96.png": { size: 96, kind: "logo" },
} as const;
export type IconName = keyof typeof ICONS;

export function isIconName(value: string): value is IconName {
  return Object.hasOwn(ICONS, value);
}

export type IconSource = { logoUrl: string | null; primaryColor: string; updatedAt: Date };

/** Changes whenever the logo or colour changes, so browsers fetch new icons. */
export function iconVersion(source: IconSource): string {
  return createHash("sha256")
    .update(`${source.logoUrl ?? ""}|${source.primaryColor}`)
    .digest("hex")
    .slice(0, 10);
}

/** Small (96 px) copy of the store logo for the header and footer; versioned like the icons. */
export function storeLogoSrc(source: IconSource): string {
  return `/icons/logo-96.png?v=${iconVersion(source)}`;
}
