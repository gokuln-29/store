"use client";

import Script from "next/script";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { confirmRazorpayPaymentAction } from "@/lib/actions/checkout.actions";
import { formatINR } from "@/lib/utils/money";

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open(): void;
  on(event: "payment.failed", handler: (response: unknown) => void): void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export type RazorpayPaymentProps = {
  keyId: string;
  providerOrderId: string;
  orderNumber: string;
  amount: number;
  storeName: string;
  logoUrl: string | null;
  themeColor: string;
  prefill: { name: string; email: string | null; contact: string };
  /** When the order expires (ISO); the payment window closes then. */
  expiresAt: string | null;
};

/**
 * Opens Razorpay Checkout for an existing Razorpay order. The success result is sent to the
 * server, which verifies its signature and confirms the payment with Razorpay; the webhook
 * confirms it too, so closing the tab after paying is safe.
 */
export function RazorpayPayment(props: RazorpayPaymentProps) {
  const t = useTranslations("Order");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const autoOpened = useRef(false);

  const onSuccess = useCallback(
    (response: RazorpaySuccess) =>
      startTransition(async () => {
        setMessage(undefined);
        try {
          const result = await confirmRazorpayPaymentAction({
            orderNumber: props.orderNumber,
            ...response,
          });
          if (!result.ok && result.error !== "order_expired") {
            return setMessage(errorText(result.error));
          }
          if (result.ok && result.data.status === "failed") {
            return setMessage(t("paymentFailed"));
          }
          // Paid, still settling (the webhook will finish it) or expired-and-refunded: the
          // order page shows the right state.
          router.replace(`/order/${props.orderNumber}`);
        } catch {
          setMessage(t("paymentPending"));
          router.replace(`/order/${props.orderNumber}`);
        }
      }),
    [errorText, props.orderNumber, router, t],
  );

  const open = useCallback(() => {
    if (!window.Razorpay) return setScriptFailed(true);
    setMessage(undefined);
    const secondsLeft = props.expiresAt
      ? Math.floor((Date.parse(props.expiresAt) - Date.now()) / 1000)
      : 15 * 60;
    const checkout = new window.Razorpay({
      key: props.keyId,
      order_id: props.providerOrderId,
      amount: props.amount,
      currency: "INR",
      name: props.storeName,
      description: t("number", { number: props.orderNumber }),
      ...(props.logoUrl ? { image: props.logoUrl } : {}),
      prefill: {
        name: props.prefill.name,
        contact: props.prefill.contact,
        ...(props.prefill.email ? { email: props.prefill.email } : {}),
      },
      theme: { color: props.themeColor },
      timeout: Math.max(60, secondsLeft),
      retry: { enabled: true },
      handler: onSuccess,
      modal: {
        confirm_close: true,
        ondismiss: () => setMessage(t("paymentCancelled")),
      },
    });
    // Razorpay lets the customer retry inside the window; the webhook records the failure.
    checkout.on("payment.failed", () => setMessage(t("paymentFailed")));
    checkout.open();
  }, [onSuccess, props, t]);

  useEffect(() => {
    if (ready && !autoOpened.current) {
      autoOpened.current = true;
      open();
    }
  }, [open, ready]);

  return (
    <div className="grid gap-3">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setScriptFailed(true)}
      />
      {(message || scriptFailed) && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {scriptFailed ? t("scriptFailed") : message}
        </p>
      )}
      {isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("verifying")}
        </p>
      )}
      <Button size="lg" disabled={!ready || isPending} onClick={open}>
        {t("payAmount", { amount: formatINR(props.amount, locale) })}
      </Button>
    </div>
  );
}
