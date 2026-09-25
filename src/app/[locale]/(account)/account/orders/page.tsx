import Image from "next/image";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { listCustomerOrders } from "@/lib/services/order.service";
import { formatDateTime } from "@/lib/utils/format";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { formatINR } from "@/lib/utils/money";

const PAGE_SIZE = 10;

export async function generateMetadata() {
  const t = await getTranslations("MyOrders");
  return { title: t("title"), robots: { index: false } };
}

export default async function MyOrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/orders">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/account/orders`);
  const pageParam = (await searchParams).page;
  const page = Math.max(
    1,
    Math.min(1000, Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1),
  );
  const [t, { rows, total }] = await Promise.all([
    getTranslations("MyOrders"),
    listCustomerOrders(user.id, page, PAGE_SIZE),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total === 0) {
    return (
      <section className="grid justify-items-start gap-3">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("empty")}</p>
        <Button asChild>
          <Link href="/shop">{t("startShopping")}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="orders-heading" className="grid gap-4">
      <h2 id="orders-heading" className="text-xl font-semibold">
        {t("title")}
      </h2>
      <ul className="grid gap-3">
        {rows.map((order) => (
          <li key={order.id}>
            <Link
              href={`/account/orders/${order.orderNumber}`}
              className="grid gap-3 rounded-lg border p-4 transition-colors hover:bg-accent sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{order.orderNumber}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("placedOn", { date: formatDateTime(order.createdAt, locale) })} ·{" "}
                  {t("itemCount", { count: order._count.items })}
                </p>
                <div className="flex items-center gap-2">
                  {order.items.map((item) => (
                    <span
                      key={item.id}
                      className="relative size-10 overflow-hidden rounded bg-muted"
                      title={localize(item.productName, locale)}
                    >
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={localize(item.productName, locale)}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized={isLocalUpload(item.imageUrl)}
                        />
                      )}
                    </span>
                  ))}
                  {order._count.items > order.items.length && (
                    <span className="text-xs text-muted-foreground">
                      {t("moreItems", { count: order._count.items - order.items.length })}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-lg font-semibold tabular-nums sm:text-right">
                {formatINR(order.total, locale)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/account/orders?page=${page - 1}`}>{t("previous")}</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">{t("pageOf", { page, pages })}</span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/account/orders?page=${page + 1}`}>{t("next")}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
