"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { adminLoginAction } from "@/lib/actions/auth.actions";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/validators/auth";

export function AdminLoginForm({ callbackUrl }: { callbackUrl: string | null }) {
  const t = useTranslations("AdminLogin");
  const errorText = useErrorText();
  const locale = useLocale();
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AdminLoginInput, unknown, z.output<typeof adminLoginSchema>>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await adminLoginAction(values, callbackUrl, locale);
      // On success the action redirects, so a result only comes back on failure.
      if (result && !result.ok) {
        setFormError(errorText(result.error));
        form.setValue("password", "");
        form.setFocus("password");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="email" label={t("email")} error={errorText(errors.email?.message)}>
        {(aria) => (
          <Input
            type="email"
            autoComplete="username"
            inputMode="email"
            {...aria}
            {...form.register("email")}
          />
        )}
      </FormField>
      <FormField id="password" label={t("password")} error={errorText(errors.password?.message)}>
        {(aria) => (
          <Input
            type="password"
            autoComplete="current-password"
            {...aria}
            {...form.register("password")}
          />
        )}
      </FormField>
      <Button type="submit" disabled={isPending} className="mt-2 w-full">
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
