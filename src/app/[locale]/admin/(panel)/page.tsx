import { Download } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ColumnChart } from "@/components/admin/dashboard/column-chart";
import { FunnelBars } from "@/components/admin/dashboard/funnel-bars";
import { StatTile } from "@/components/admin/dashboard/stat-tile";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import {
  getDashboard,
  lowStock,
  percentChange,
  RANGES,
  type Range,
} from "@/lib/services/dashboard.service";
import { getFeatures } from "@/lib/services/settings.service";
import { db } from "@/lib/db";
import { localize } from "@/lib/utils/localized";
import { formatINR } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("dashboardTitle"), robots: { index: false, follow: false } };
}

const TAGS: Record<string, string> = { en: "en-IN", ta: "ta-IN", kn: "kn-IN" };

export default async function AdminDashboardPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("admin:access", locale, `/${locale}/admin`);
  const [t, tRoles, features] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Roles"),
    getFeatures(),
  ]);
  const rangeParam = (await searchParams).range;
  const range: Range = (RANGES as readonly string[]).includes(String(rangeParam))
    ? (rangeParam as Range)
    : "7d";
  const canSeeSales = can(user.role, "reports:read");
  const money = (p: number) => formatINR(p, locale);
  const count = (n: number) =>
    new Intl.NumberFormat(TAGS[locale] ?? "en-IN", { numberingSystem: "latn" }).format(n);

  const header = (
    <div>
      <AdminPageHeader
        title={t("title")}
        actions={
          canSeeSales ? (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/admin/export/orders?range=${range}`} download>
                  <Download aria-hidden />
                  {t("exportOrders")}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/api/admin/export/customers" download>
                  <Download aria-hidden />
                  {t("exportCustomers")}
                </a>
              </Button>
            </>
          ) : null
        }
      />
      <p className="-mt-4 text-sm text-muted-foreground" data-testid="admin-identity">
        {t("signedInAs", { email: user.email ?? "", role: tRoles(user.role) })}
      </p>
    </div>
  );

  const [toConfirm, pendingReviews, low] = canSeeSales
    ? [0, 0, []]
    : await Promise.all([
        db.order.count({ where: { status: "PLACED" } }),
        db.review.count({ where: { status: "PENDING" } }),
        lowStock(),
      ]);
  const data = canSeeSales ? await getDashboard(range) : null;
  const todo = {
    toConfirm: data?.toConfirm ?? toConfirm,
    pendingReviews: data?.pendingReviews ?? pendingReviews,
  };
  const stock = data?.lowStock ?? low;

  const todoCard = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/admin/orders?status=PLACED" className="rounded-lg border p-4 hover:bg-accent">
        <p className="text-sm text-muted-foreground">{t("toConfirm")}</p>
        <p className="text-2xl font-semibold">{count(todo.toConfirm)}</p>
      </Link>
      {features.reviews && (
        <Link
          href="/admin/reviews?status=PENDING"
          className="rounded-lg border p-4 hover:bg-accent"
        >
          <p className="text-sm text-muted-foreground">{t("pendingReviews")}</p>
          <p className="text-2xl font-semibold">{count(todo.pendingReviews)}</p>
        </Link>
      )}
    </div>
  );

  const stockCard = (
    <Card>
      <CardHeader>
        <CardTitle>{t("lowStock")}</CardTitle>
      </CardHeader>
      <CardContent>
        {stock.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLowStock")}</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{t("lowStock")}</caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 font-medium">{t("product")}</th>
                <th className="py-1 text-right font-medium">{t("inStock")}</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((v) => (
                <tr key={v.variantId} className="border-b last:border-0">
                  <td className="py-1.5">
                    <Link href={`/admin/products/${v.productId}`} className="hover:underline">
                      {localize(v.name, locale)}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{v.sku}</span>
                  </td>
                  <td
                    className={cn(
                      "py-1.5 text-right tabular-nums",
                      v.stock === 0 && "font-semibold text-destructive",
                    )}
                  >
                    {v.stock === 0 ? t("soldOut") : count(v.stock)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );

  if (!data) {
    return (
      <div className="grid gap-6">
        {header}
        {todoCard}
        {stockCard}
      </div>
    );
  }

  const periodLabel = t(`vs.${range}`);
  const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const pointLabel = (key: string) =>
    range === "today"
      ? `${key.slice(11, 13)}:00`
      : new Intl.DateTimeFormat(TAGS[locale] ?? "en-IN", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(new Date(`${key}T00:00:00Z`));
  const tableLabels = {
    period: range === "today" ? t("hour") : t("day"),
    showTable: t("showTable"),
  };

  return (
    <div className="grid gap-6">
      {header}

      <nav aria-label={t("range")} className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button key={r} asChild size="sm" variant={r === range ? "default" : "outline"}>
            <Link href={`/admin?range=${r}`} aria-current={r === range ? "page" : undefined}>
              {t(`ranges.${r}`)}
            </Link>
          </Button>
        ))}
      </nav>

      <section aria-label={t("summary")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("revenue")}
          value={money(data.current.revenue)}
          change={percentChange(data.current.revenue, data.previous.revenue)}
          changeLabel={periodLabel}
        />
        <StatTile
          label={t("orders")}
          value={count(data.current.orders)}
          change={percentChange(data.current.orders, data.previous.orders)}
          changeLabel={periodLabel}
        />
        <StatTile
          label={t("aov")}
          value={money(data.current.aov)}
          change={percentChange(data.current.aov, data.previous.aov)}
          changeLabel={periodLabel}
        />
        <StatTile
          label={t("conversion")}
          value={features.analytics ? `${rate(data.funnel.orders, data.funnel.visits)}%` : "—"}
          change={null}
          changeLabel={features.analytics ? t("conversionHint") : t("analyticsOff")}
        />
      </section>
      <p className="-mt-3 text-xs text-muted-foreground">{t("definitions")}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <ColumnChart
              title={t("revenueChart")}
              points={data.series.map((p) => ({
                label: pointLabel(p.key),
                value: p.revenue,
                display: money(p.revenue),
              }))}
              format="inr"
              locale={locale}
              tableLabels={{ ...tableLabels, value: t("revenue") }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ColumnChart
              title={t("ordersChart")}
              points={data.series.map((p) => ({
                label: pointLabel(p.key),
                value: p.orders,
                display: count(p.orders),
              }))}
              format="count"
              locale={locale}
              tableLabels={{ ...tableLabels, value: t("orders") }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("funnel")}</CardTitle>
          </CardHeader>
          <CardContent>
            {features.analytics ? (
              <FunnelBars
                stages={[
                  { label: t("stages.visits"), value: data.funnel.visits },
                  { label: t("stages.carts"), value: data.funnel.carts },
                  { label: t("stages.checkouts"), value: data.funnel.checkouts },
                  { label: t("stages.orders"), value: data.funnel.orders },
                ]}
                formatCount={count}
                ofPrevious={(pct) => t("ofPrevious", { percent: pct })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t("analyticsOff")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("topProducts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noSales")}</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">{t("topProducts")}</caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1 font-medium">{t("product")}</th>
                    <th className="py-1 text-right font-medium">{t("sold")}</th>
                    <th className="py-1 text-right font-medium">{t("revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.productId} className="border-b last:border-0">
                      <td className="py-1.5">
                        <Link href={`/admin/products/${p.productId}`} className="hover:underline">
                          {localize(p.name, locale)}
                        </Link>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{count(p.quantity)}</td>
                      <td className="py-1.5 text-right tabular-nums">{money(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <h2 className="font-semibold">{t("needsAttention")}</h2>
          {todoCard}
        </div>
        {stockCard}
      </div>
    </div>
  );
}
