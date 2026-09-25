import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { couponCategoryOptions, getCoupon } from "@/lib/services/coupon.service";
import { categoryOptions, couponFormDefaults } from "@/lib/utils/coupon-view";
import { formatDateTime } from "@/lib/utils/format";
import { localize } from "@/lib/utils/localized";
import { formatINR } from "@/lib/utils/money";

export async function generateMetadata() {
  const t = await getTranslations("Coupons");
  return { title: t("edit") };
}

export default async function EditCouponPage({
  params,
}: PageProps<"/[locale]/admin/coupons/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("coupons:manage", locale);
  const [t, tOrder, data, categories] = await Promise.all([
    getTranslations("Coupons"),
    getTranslations("Order"),
    getCoupon(id),
    couponCategoryOptions(),
  ]);
  if (!data) notFound();
  const { coupon, stats, recentOrders, products } = data;
  const money = (p: number) => formatINR(p, locale);

  return (
    <>
      <AdminPageHeader
        title={coupon.code}
        breadcrumbs={[{ label: t("title"), href: "/admin/coupons" }, { label: coupon.code }]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <CouponForm
          id={coupon.id}
          defaults={couponFormDefaults(coupon)}
          categories={categoryOptions(categories, (n) => localize(n, locale))}
          selectedProducts={products.map((p) => ({
            id: p.id,
            label: localize(p.name, locale) || p.slug,
          }))}
        />
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("performance")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("uses")}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{stats.uses}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("discountGiven")}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{money(stats.discount)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">{t("revenue")}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{money(stats.revenue)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("recentOrders")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
              ) : (
                <ul className="divide-y text-sm">
                  {recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                        {o.orderNumber}
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(o.createdAt, locale)} · {tOrder(`status${o.status}`)}
                        </span>
                      </Link>
                      <span className="tabular-nums">−{money(o.discountTotal)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
