/**
 * Fonts a store owner can pick. They are self-hosted with next/font (src/lib/fonts/store-fonts.ts)
 * and exposed as CSS variables. Tamil and Kannada text always falls back to Noto Sans Tamil /
 * Kannada (loaded in the root layout).
 */
export const STORE_FONTS = [
  { name: "Noto Sans", cssVar: "--font-noto-sans" },
  { name: "Inter", cssVar: "--font-store-inter" },
  { name: "Poppins", cssVar: "--font-store-poppins" },
  { name: "Lato", cssVar: "--font-store-lato" },
  { name: "Montserrat", cssVar: "--font-store-montserrat" },
  { name: "Playfair Display", cssVar: "--font-store-playfair" },
  { name: "Merriweather", cssVar: "--font-store-merriweather" },
  { name: "Mukta", cssVar: "--font-store-mukta" },
] as const;

export type StoreFontName = (typeof STORE_FONTS)[number]["name"];
export const STORE_FONT_NAMES = STORE_FONTS.map((f) => f.name) as [
  StoreFontName,
  ...StoreFontName[],
];

/** `var(--font-store-…)` for a font name; Noto Sans for unknown names. */
export function fontVar(name: string): string {
  const font = STORE_FONTS.find((f) => f.name === name);
  return `var(${font?.cssVar ?? "--font-noto-sans"})`;
}
