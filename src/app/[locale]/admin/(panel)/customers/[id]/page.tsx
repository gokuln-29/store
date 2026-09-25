import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { getCustomer } from "@/lib/services/customer.service";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";
import { formatIndianMobile } from "@/lib/utils/phone";

export async function generateMetadata() {
  const t = await getTranslations("Customers");
  return { title: t("detailTitle") };
}

export default async function CustomerPage({
  params,
}: PageProps<"/[locale]/admin/customers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("customers:read", locale);
  const [t, data] = await Promise.all([getTranslations("Customers"), getCustomer(id)]);
  if (!data) notFound();
  const { user, stats } = data;
  const title = user.name || (user.phone ? formatIndianMobile(user.phone) : t("noName"));
  const money = (p: number) => formatINR(p, locale);

  return (
    <>
      <AdminPageHeader
        title={title}
        breadcrumbs={[{ label: t("title"), href: "/admin/customers" }, { label: title }]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>{t("orderHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {user.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {user.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                      {o.orderNumber}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatDateTime(o.createdAt, locale)}
                      </span>
                    </Link>
                    <span className="flex items-center gap-3">
                      <OrderStatusBadge status={o.status} />
                      <span className="tabular-nums">{money(o.total)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("orders")}</dt>
                  <dd className="text-lg font-semibold">{stats.orders}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("ltv")}</dt>
                  <dd className="text-lg font-semibold">{money(stats.ltv)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("aov")}</dt>
                  <dd className="font-semibold">
                    {money(stats.orders ? Math.round(stats.ltv / stats.orders) : 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("joined")}</dt>
                  <dd>{formatDateTime(user.createdAt, locale)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("contact")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              {user.phone && <p>{formatIndianMobile(user.phone)}</p>}
              {user.email && <p className="break-all">{user.email}</p>}
              {user.addresses.map((a) => (
                <address key={a.id} className="mt-2 text-muted-foreground not-italic">
                  {a.name}, {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                </address>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
