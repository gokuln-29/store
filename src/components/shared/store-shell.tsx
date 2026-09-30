import type { CSSProperties, ReactNode } from "react";
import { fontVar } from "@/lib/constants/fonts";
import { getStoreSettings } from "@/lib/services/settings.service";
import { readableForeground } from "@/lib/utils/color";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { AnalyticsBeacon } from "@/components/store/analytics-beacon";
import { CartSync } from "@/components/store/cart/cart-sync";
import { FeaturesProvider } from "@/components/store/features-context";
import { WishlistSync } from "@/components/store/wishlist/wishlist-sync";
import { resolveFeatures } from "@/lib/features";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// "Rupee Local" (see globals.css) supplies only ₹, so prices don't download Latin Extended.
const INDIC_FALLBACK =
  '"Rupee Local", var(--font-noto-sans), var(--font-noto-tamil), var(--font-noto-kannada), sans-serif';

function fontStack(name: string): string {
  return `"Rupee Local", ${fontVar(name)}, ${INDIC_FALLBACK}`;
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
    ...storeFontStyle(settings),
  } as CSSProperties;
}

/**
 * The store's fonts as CSS variables. Set on <html> (root layout) so everything, including the
 * skip link and toasts outside the storefront shell, uses them and no unused font downloads.
 */
export function storeFontStyle(settings: { headingFont: string; bodyFont: string }) {
  return {
    "--store-font-body": fontStack(settings.bodyFont),
    "--store-font-heading": fontStack(settings.headingFont),
  } as CSSProperties;
}

/** Header + main + footer used by storefront and customer account pages, with the store theme. */
export async function StoreShell({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();
  return (
    <>
      <FeaturesProvider value={resolveFeatures(settings.features)}>
        <div data-store-theme style={storeThemeStyle(settings)} className="flex flex-1 flex-col">
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <CartSync />
          <WishlistSync />
          <AnalyticsBeacon />
          <InstallPrompt storeName={settings.name} />
        </div>
      </FeaturesProvider>
    </>
  );
}
