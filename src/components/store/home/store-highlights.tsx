import { Banknote, Headset, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { StoreHighlight } from "@/lib/services/storefront.service";
import { formatINR } from "@/lib/utils/money";

/** "Why shop with us" row under the hero, from the store's real settings. */
export async function StoreHighlights({
  items,
  locale,
}: {
  items: StoreHighlight[];
  locale: string;
}) {
  if (items.length < 2) return null;
  const t = await getTranslations("Home");

  const rows: { icon: LucideIcon; title: string; hint: string }[] = items.map((item) => {
    switch (item.kind) {
      case "delivery":
        return {
          icon: Truck,
          title:
            item.freeAbove != null
              ? t("deliveryFree", {
                  amount: formatINR(item.freeAbove, locale, { decimals: false }),
                })
              : t("delivery"),
          hint: t("deliveryHint"),
        };
      case "secure":
        return { icon: ShieldCheck, title: t("secure"), hint: t("secureHint") };
      case "cod":
        return { icon: Banknote, title: t("cod"), hint: t("codHint") };
      case "support":
        return {
          icon: Headset,
          title: t("support"),
          hint: t("supportHint", { phone: item.phone }),
        };
    }
  });

  return (
    <section aria-label={t("highlightsLabel")} className="container mx-auto px-4">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {rows.map(({ icon: Icon, title, hint }) => (
          <li
            key={title}
            className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:p-5"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl brand-gradient text-white shadow-md shadow-primary/20">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold sm:text-base">{title}</span>
              <span className="text-xs text-muted-foreground sm:text-sm">{hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
