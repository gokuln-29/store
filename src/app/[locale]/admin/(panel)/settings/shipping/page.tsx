import { Pencil, Plus, Truck } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteShippingRuleButton } from "@/components/admin/settings/shipping-rule-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { listShippingRules } from "@/lib/services/settings.service";
import { formatINR } from "@/lib/utils/money";

export async function generateMetadata() {
  const t = await getTranslations("Settings");
  return { title: `${t("shipping")} · ${t("title")}` };
}

export default async function ShippingRulesPage({
  params,
}: PageProps<"/[locale]/admin/settings/shipping">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const [t, tAddr, tData] = await Promise.all([
    getTranslations("Shipping"),
    getTranslations("Addresses"),
    getTranslations("DataTable"),
  ]);
  const rules = await listShippingRules();
  const money = (paise: number | null) => (paise == null ? "–" : formatINR(paise, locale));

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/settings/shipping/new">
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Link>
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed bg-background px-4 py-12 text-center">
          <Truck className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">{t("empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <caption className="sr-only">{t("title")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("matches")}</TableHead>
                <TableHead>{t("charge")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("priority")}</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">{tData("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const areas = [...rule.pincodePrefixes.map((p) => `${p}…`), ...rule.stateCodes];
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-medium">{rule.name}</div>
                      {!rule.isActive && <Badge variant="secondary">{t("inactive")}</Badge>}
                      {rule.estimatedDaysMin != null && rule.estimatedDaysMax != null && (
                        <div className="text-xs text-muted-foreground">
                          {t("eta", { min: rule.estimatedDaysMin, max: rule.estimatedDaysMax })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 text-sm">
                      {areas.length ? areas.join(", ") : t("allIndia")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.rateType === "FLAT"
                        ? money(rule.flatRate)
                        : t("weightCharge", {
                            baseRate: money(rule.baseRate),
                            baseWeight: rule.baseWeightGrams ?? 0,
                            additionalRate: money(rule.additionalRate),
                            additionalWeight: rule.additionalWeightGrams ?? 0,
                          })}
                      {rule.freeShippingThreshold != null && (
                        <div className="text-xs text-muted-foreground">
                          {t("freeAboveShort", { amount: money(rule.freeShippingThreshold) })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{rule.priority}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          href={`/admin/settings/shipping/${rule.id}`}
                          aria-label={`${tAddr("edit")}: ${rule.name}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                      </Button>
                      <DeleteShippingRuleButton id={rule.id} name={rule.name} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
