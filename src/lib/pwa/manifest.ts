import type { MetadataRoute } from "next";
import { localize } from "@/lib/utils/localized";
import { ICONS, iconVersion, type IconSource } from "./icon-meta";

export type ManifestSettings = IconSource & {
  name: string;
  tagline: unknown;
  defaultLocale: string;
};

/** "Neo Store Online" → at most 12 characters for home screen labels. */
export function shortName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 12) return trimmed;
  const firstWords = trimmed.split(/\s+/).reduce((acc, word) => {
    const next = acc ? `${acc} ${word}` : word;
    return next.length <= 12 ? next : acc;
  }, "");
  return firstWords || trimmed.slice(0, 12);
}

export function buildManifest(settings: ManifestSettings): MetadataRoute.Manifest {
  const v = iconVersion(settings);
  const icon = (name: keyof typeof ICONS, purpose: "any" | "maskable") => ({
    src: `/icons/${name}?v=${v}`,
    sizes: `${ICONS[name].size}x${ICONS[name].size}`,
    type: "image/png",
    purpose,
  });
  const locale = settings.defaultLocale;
  return {
    id: "/",
    name: settings.name,
    short_name: shortName(settings.name),
    description: localize(settings.tagline, locale) || undefined,
    lang: locale,
    start_url: `/${locale}?source=pwa`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: settings.primaryColor,
    categories: ["shopping"],
    icons: [
      icon("icon-192.png", "any"),
      icon("icon-512.png", "any"),
      icon("maskable-192.png", "maskable"),
      icon("maskable-512.png", "maskable"),
    ],
  };
}
