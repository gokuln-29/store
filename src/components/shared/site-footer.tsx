import { getTranslations } from "next-intl/server";
import { getStoreSettings } from "@/lib/services/settings.service";

export async function SiteFooter() {
  const [t, settings] = await Promise.all([getTranslations("Footer"), getStoreSettings()]);

  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        {t("rights", { year: new Date().getFullYear(), storeName: settings.name })}
      </div>
    </footer>
  );
}
