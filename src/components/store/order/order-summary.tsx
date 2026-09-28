import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { formatINR } from "@/lib/utils/money";

type OptionSnapshot = { label: unknown; value: unknown }[];

export type OrderSummaryData = {
  items: {
    id: string;
    productName: unknown;
    optionValues: unknown;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
  }[];
  subtotal: number;
  discountTotal: number;
  couponCode: string | null;
  shippingTotal: number;
  codFee: number;
  taxTotal: number;
  total: number;
  pricesIncludeTax: boolean;
};

/** Items and totals of a placed order (as charged, from the order snapshot). */
export async function OrderSummary({ order, locale }: { order: OrderSummaryData; locale: string }) {
  const [t, tCheckout] = await Promise.all([getTranslations("Order"), getTranslations("Checkout")]);
  const money = (paise: number) => formatINR(paise, locale);

  return (
    <section aria-labelledby="items-heading" className="grid gap-3">
      <h2 id="items-heading" className="text-lg font-semibold">
        {t("items")}
      </h2>
      <ul className="divide-y rounded-lg border">
        {order.items.map((item) => {
          const options = ((item.optionValues as OptionSnapshot) ?? [])
            .map((o) => localize(o.value, locale) || String(o.value))
            .join(" / ");
          return (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized={isLocalUpload(item.imageUrl)}
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{localize(item.productName, locale)}</p>
                <p className="text-xs text-muted-foreground">
                  {options && `${options} · `}
                  {tCheckout("qty", { count: item.quantity })}
                </p>
              </div>
              {/* Before discount, so the lines add up to the subtotal; the discount is listed below. */}
              <p className="text-sm tabular-nums">{money(item.unitPrice * item.quantity)}</p>
            </li>
          );
        })}
      </ul>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <dt>{tCheckout("subtotal")}</dt>
          <dd className="tabular-nums">{money(order.subtotal)}</dd>
        </div>
        {order.discountTotal > 0 && (
          <div className="flex justify-between text-emerald-700">
            <dt>
              {tCheckout("discount")}
              {order.couponCode && ` (${order.couponCode})`}
            </dt>
            <dd className="tabular-nums">−{money(order.discountTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>{tCheckout("shippingLine")}</dt>
          <dd className="tabular-nums">
            {order.shippingTotal === 0 ? tCheckout("free") : money(order.shippingTotal)}
          </dd>
        </div>
        {order.codFee > 0 && (
          <div className="flex justify-between">
            <dt>{tCheckout("codFee")}</dt>
            <dd className="tabular-nums">{money(order.codFee)}</dd>
          </div>
        )}
        {!order.pricesIncludeTax && (
          <div className="flex justify-between">
            <dt>{tCheckout("gst")}</dt>
            <dd className="tabular-nums">{money(order.taxTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <dt>{tCheckout("total")}</dt>
          <dd className="tabular-nums">{money(order.total)}</dd>
        </div>
      </dl>
      {order.pricesIncludeTax && order.taxTotal > 0 && (
        <p className="text-xs text-muted-foreground">
          {tCheckout("gstIncluded", { amount: money(order.taxTotal) })}
        </p>
      )}
    </section>
  );
}
