import {
  Inter,
  Lato,
  Merriweather,
  Montserrat,
  Mukta,
  Playfair_Display,
  Poppins,
} from "next/font/google";

/*
 * Every font a store owner can pick (Settings → Branding), self-hosted by next/font: no request
 * to Google and no render-blocking stylesheet. Nothing is preloaded; the browser downloads a
 * font file only when the page actually uses that font. (next/font needs literal options.)
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-store-inter",
});
const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-poppins",
});
const lato = Lato({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
  variable: "--font-store-lato",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-store-montserrat",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-store-playfair",
});
const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
  variable: "--font-store-merriweather",
});
const mukta = Mukta({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-mukta",
});

/** Class names that define the --font-store-* variables; set once on <html>. */
export const storeFontVariables = [inter, poppins, lato, montserrat, playfair, merriweather, mukta]
  .map((f) => f.variable)
  .join(" ");
