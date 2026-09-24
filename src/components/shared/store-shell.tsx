import type { CSSProperties, ReactNode } from "react";
import { STORE_FONTS, googleFontsHref } from "@/lib/constants/fonts";
import { getStoreSettings } from "@/lib/services/settings.service";
import { readableForeground } from "@/lib/utils/color";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const INDIC_FALLBACK =
  "var(--font-noto-sans), var(--font-noto-tamil), var(--font-noto-kannada), sans-serif";

function fontStack(name: string): string {
  const font = STORE_FONTS.find((f) => f.name === name);
  return font?.googleId ? `"${font.family}", ${INDIC_FALLBACK}` : INDIC_FALLBACK;
}

/** Storefront theme variables from StoreSettings (brand colours and fonts). */
export function storeThemeStyle(settings: {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
}): CSSProperties {
  return {
    "--primary": settings.primaryColor,
    "--primary-foreground": readableForeground(settings.primaryColor),
    "--ring": settings.primaryColor,
    "--brand-secondary": settings.secondaryColor,
    "--brand-secondary-foreground": readableForeground(settings.secondaryColor),
    "--store-font-body": fontStack(settings.bodyFont),
    "--store-font-heading": fontStack(settings.headingFont),
  } as CSSProperties;
}

/** Header + main + footer used by storefront and customer account pages, with the store theme. */
export async function StoreShell({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();
  const fontsHref = googleFontsHref([settings.headingFont, settings.bodyFont]);

  return (
    <>
      {fontsHref && <link rel="stylesheet" href={fontsHref} precedence="default" />}
      <div data-store-theme style={storeThemeStyle(settings)} className="flex flex-1 flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
