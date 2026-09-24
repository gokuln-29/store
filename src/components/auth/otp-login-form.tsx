"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { requestOtpAction, verifyOtpAction } from "@/lib/actions/auth.actions";
import type { ActionResult } from "@/lib/actions/result";
import {
  otpRequestSchema,
  otpVerifySchema,
  type OtpRequestInput,
  type OtpVerifyInput,
} from "@/lib/validators/auth";

type Sent = { phone: string; maskedPhone: string };

/** Resend countdown. `start(seconds)` begins a new countdown; returns seconds left. */
function useCountdown() {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setDeadline(current + seconds * 1000);
  }, []);

  return [Math.max(0, Math.ceil((deadline - now) / 1000)), start] as const;
}

export function OtpLoginForm({ callbackUrl }: { callbackUrl: string | null }) {
  const t = useTranslations("CustomerLogin");
  const errorText = useErrorText();
  const locale = useLocale();
  const [sent, setSent] = useState<Sent | null>(null);
  const [formError, setFormError] = useState<string>();
  const [secondsLeft, startCountdown] = useCountdown();
  const [isPending, startTransition] = useTransition();

  const phoneForm = useForm<OtpRequestInput, unknown, z.output<typeof otpRequestSchema>>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { phone: "" },
  });
  const codeForm = useForm<OtpVerifyInput, unknown, z.output<typeof otpVerifySchema>>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { phone: "", code: "" },
  });

  function showError(result: Extract<ActionResult<unknown>, { ok: false }>) {
    setFormError(errorText(result.error, { seconds: result.retryAfterSeconds ?? 0 }));
    if (result.retryAfterSeconds && result.error === "otp_cooldown") {
      startCountdown(result.retryAfterSeconds);
    }
  }

  function sendCode(phone: string, isResend: boolean) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await requestOtpAction({ phone }, locale);
      if (!result.ok) {
        if (result.fieldErrors?.phone) {
          phoneForm.setError("phone", { message: result.fieldErrors.phone });
        } else {
          showError(result);
        }
        return;
      }
      setSent({ phone: result.data.phone, maskedPhone: result.data.maskedPhone });
      codeForm.reset({ phone: result.data.phone, code: "" });
      startCountdown(result.data.resendAfterSeconds);
      if (isResend) toast.success(t("codeResent"));
    });
  }

  const onPhoneSubmit = phoneForm.handleSubmit(({ phone }) => sendCode(phone, false));

  const onCodeSubmit = codeForm.handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await verifyOtpAction(values, callbackUrl, locale);
      if (result && !result.ok) {
        showError(result);
        codeForm.setValue("code", "");
        codeForm.setFocus("code");
      }
    });
  });

  const errorBanner = formError && (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{formError}</AlertDescription>
    </Alert>
  );

  if (!sent) {
    return (
      <form onSubmit={onPhoneSubmit} noValidate className="grid gap-4">
        {errorBanner}
        <FormField
          id="phone"
          label={t("phone")}
          error={errorText(phoneForm.formState.errors.phone?.message)}
        >
          {(aria) => (
            <div className="flex items-center gap-2">
              <span className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                +91
              </span>
              <Input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={14}
                autoFocus
                {...aria}
                {...phoneForm.register("phone")}
              />
            </div>
          )}
        </FormField>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? t("sending") : t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onCodeSubmit} noValidate className="grid gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("codeSent", { phone: sent.maskedPhone })}
      </p>
      {errorBanner}
      <FormField
        id="code"
        label={t("code")}
        error={errorText(codeForm.formState.errors.code?.message)}
      >
        {(aria) => (
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            className="text-center text-lg tracking-[0.5em]"
            {...aria}
            {...codeForm.register("code")}
          />
        )}
      </FormField>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t("verifying") : t("verify")}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          onClick={() => {
            setSent(null);
            setFormError(undefined);
          }}
        >
          {t("changeNumber")}
        </Button>
        {secondsLeft > 0 ? (
          <span className="text-muted-foreground" aria-live="polite">
            {t("resendIn", { seconds: secondsLeft })}
          </span>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            disabled={isPending}
            onClick={() => sendCode(sent.phone, true)}
          >
            {t("resend")}
          </Button>
        )}
      </div>
    </form>
  );
}
