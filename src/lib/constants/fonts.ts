/**
 * Fonts a store owner can pick. All are on Google Fonts. Tamil and Kannada text always
 * falls back to Noto Sans Tamil / Kannada (loaded in the root layout).
 */
export const STORE_FONTS = [
  { name: "Noto Sans", family: "Noto Sans", googleId: null }, // bundled with next/font
  { name: "Inter", family: "Inter", googleId: "Inter:wght@400;500;600;700" },
  { name: "Poppins", family: "Poppins", googleId: "Poppins:wght@400;500;600;700" },
  { name: "Lato", family: "Lato", googleId: "Lato:wght@400;700" },
  { name: "Montserrat", family: "Montserrat", googleId: "Montserrat:wght@400;500;600;700" },
  {
    name: "Playfair Display",
    family: "Playfair Display",
    googleId: "Playfair+Display:wght@500;600;700",
  },
  { name: "Merriweather", family: "Merriweather", googleId: "Merriweather:wght@400;700" },
  { name: "Mukta", family: "Mukta", googleId: "Mukta:wght@400;500;600;700" },
] as const;

export type StoreFontName = (typeof STORE_FONTS)[number]["name"];
export const STORE_FONT_NAMES = STORE_FONTS.map((f) => f.name) as [
  StoreFontName,
  ...StoreFontName[],
];

export function googleFontsHref(names: readonly string[]): string | null {
  const ids = [...new Set(names)]
    .map((n) => STORE_FONTS.find((f) => f.name === n)?.googleId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));
  if (!ids.length) return null;
  return `https://fonts.googleapis.com/css2?${ids.map((id) => `family=${id}`).join("&")}&display=swap`;
}
