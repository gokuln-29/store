import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MockPayment } from "@/components/store/checkout/mock-payment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guards";
import { getCustomerOrder } from "@/lib/services/checkout.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Order");
  return { title: t("testPaymentTitle"), robots: { index: false } };
}

/** Payment step for online orders with the development (mock) provider. */
export default async function PayPage({
  params,
}: PageProps<"/[locale]/checkout/pay/[orderNumber]">) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/checkout/pay/${orderNumber}`);
  const order = await getCustomerOrder(decodeURIComponent(orderNumber), user.id);
  if (!order || order.paymentMethod !== "ONLINE") notFound();
  if (order.status !== "PENDING_PAYMENT") redirect(`/${locale}/order/${order.orderNumber}`);
  const t = await getTranslations("Order");

  return (
    <div className="container mx-auto flex justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">{t("testPaymentTitle")}</h1>
          </CardTitle>
          <CardDescription>
            {t("number", { number: order.orderNumber })}. {t("testPaymentHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MockPayment orderNumber={order.orderNumber} amount={order.total} />
        </CardContent>
      </Card>
    </div>
  );
}
