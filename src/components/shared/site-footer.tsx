import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const tCommon = await getTranslations("Common");
  // TODO(phase-1): read store name, contact info and social links from StoreSettings.
  const storeName = tCommon("storeNamePlaceholder");

  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        {t("rights", { year: new Date().getFullYear(), storeName })}
      </div>
    </footer>
  );
}
