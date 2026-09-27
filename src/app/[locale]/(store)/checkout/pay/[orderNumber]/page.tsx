import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MockPayment } from "@/components/store/checkout/mock-payment";
import { RazorpayPayment } from "@/components/store/checkout/razorpay-payment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { razorpayKeyId } from "@/lib/providers/payment/razorpay";
import { getCustomerOrder } from "@/lib/services/checkout.service";
import { ensurePaymentSession } from "@/lib/services/payment.service";
import { getStoreSettings } from "@/lib/services/settings.service";
import { formatTime } from "@/lib/utils/format";
import { logger } from "@/lib/logger";

const log = logger("pay");

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Order");
  return { title: t("paymentTitle"), robots: { index: false } };
}

/** Payment step for online orders. Also where customers retry a failed payment. */
export default async function PayPage({
  params,
}: PageProps<"/[locale]/checkout/pay/[orderNumber]">) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/checkout/pay/${orderNumber}`);
  // Expires the order first if its payment window has passed.
  const order = await getCustomerOrder(decodeURIComponent(orderNumber), user.id);
  if (!order || order.paymentMethod !== "ONLINE") notFound();
  if (order.status !== "PENDING_PAYMENT") redirect(`/${locale}/order/${order.orderNumber}`);

  const [t, settings] = await Promise.all([getTranslations("Order"), getStoreSettings()]);
  let session: Awaited<ReturnType<typeof ensurePaymentSession>> = null;
  let unavailable = false;
  try {
    session = await ensurePaymentSession(order.id);
  } catch (error) {
    log.error("payment session failed", { orderNumber: order.orderNumber }, error);
    unavailable = true;
  }
  if (!session && !unavailable) redirect(`/${locale}/order/${order.orderNumber}`);

  const isMock = session?.provider === "mock";

  return (
    <div className="container mx-auto flex justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">{isMock ? t("testPaymentTitle") : t("paymentTitle")}</h1>
          </CardTitle>
          <CardDescription className="grid gap-1">
            <span>{t("number", { number: order.orderNumber })}</span>
            <span>{isMock ? t("testPaymentHint") : t("paymentHint")}</span>
            {order.expiresAt && (
              <span>{t("payBefore", { time: formatTime(order.expiresAt, locale) })}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {order.paymentStatus === "FAILED" && (
            <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              {t("lastAttemptFailed")}
            </p>
          )}
          {unavailable || !session ? (
            <>
              <p role="alert" className="text-sm text-destructive">
                {t("paymentUnavailable")}
              </p>
              <Button asChild variant="outline">
                <Link href={`/checkout/pay/${order.orderNumber}`}>{t("tryAgain")}</Link>
              </Button>
            </>
          ) : isMock ? (
            <MockPayment orderNumber={order.orderNumber} amount={order.total} />
          ) : (
            <RazorpayPayment
              keyId={razorpayKeyId()}
              providerOrderId={session.providerOrderId}
              orderNumber={order.orderNumber}
              amount={session.amount}
              storeName={settings.name}
              logoUrl={settings.logoUrl}
              themeColor={settings.primaryColor}
              prefill={{
                name: order.customerName,
                email: order.customerEmail,
                contact: order.customerPhone,
              }}
              expiresAt={order.expiresAt?.toISOString() ?? null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
