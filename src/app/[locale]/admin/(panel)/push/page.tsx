import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CampaignForm } from "@/components/admin/push/campaign-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth-guards";
import { countOfferSubscribers, listCampaigns, pushConfigured } from "@/lib/services/push.service";
import { formatDateTime } from "@/lib/utils/format";
import { localize } from "@/lib/utils/localized";

export async function generateMetadata() {
  const t = await getTranslations("PushCampaigns");
  return { title: t("title") };
}

export default async function PushCampaignsPage({ params }: PageProps<"/[locale]/admin/push">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("content:manage", locale, `/${locale}/admin/push`);
  const [t, audience, { rows }] = await Promise.all([
    getTranslations("PushCampaigns"),
    countOfferSubscribers(),
    listCampaigns(1, 20),
  ]);

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
      />
      <div className="grid gap-6">
        {!pushConfigured() && (
          <p
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            {t("notConfigured")}
          </p>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{t("newCampaign")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("audience", { count: audience })}</p>
          </CardHeader>
          <CardContent>
            <CampaignForm audience={pushConfigured() ? audience : 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul className="divide-y">
                {rows.map((c) => (
                  <li
                    key={c.id}
                    className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">{localize(c.title, locale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(c.createdAt, locale)} ·{" "}
                        {c.createdBy?.name ?? c.createdBy?.email ?? ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="tabular-nums">
                        {t("stats", {
                          sent: c.sentCount,
                          audience: c.audienceCount,
                          failed: c.failedCount,
                        })}
                      </span>
                      <Badge variant={c.status === "SENT" ? "secondary" : "outline"}>
                        {t(`status.${c.status}`)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
