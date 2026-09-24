"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { routing } from "@/i18n/routing";
import { updateProfileAction } from "@/lib/actions/account.actions";
import { profileSchema, type ProfileInput } from "@/lib/validators/auth";

export function ProfileForm({ defaults, phone }: { defaults: ProfileInput; phone: string | null }) {
  const t = useTranslations("Account");
  const tCommon = useTranslations("Common");
  const tLocale = useTranslations("LocaleSwitcher");
  const errorText = useErrorText();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileInput, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateProfileAction({ ...values, email: values.email ?? "" });
      if (result.ok) {
        toast.success(t("profileSaved"));
        form.reset({ ...values, email: values.email ?? "" });
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ProfileInput, { message });
      }
      if (!result.fieldErrors) toast.error(errorText(result.error));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
      <FormField id="name" label={t("name")} error={errorText(errors.name?.message)}>
        {(aria) => <Input autoComplete="name" {...aria} {...form.register("name")} />}
      </FormField>
      <FormField id="phone" label={t("phone")} hint={t("phoneHint")}>
        {(aria) => <Input value={phone ?? ""} readOnly disabled {...aria} />}
      </FormField>
      <FormField
        id="email"
        label={`${t("email")} (${tCommon("optional")})`}
        hint={t("emailHint")}
        error={errorText(errors.email?.message)}
      >
        {(aria) => (
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            {...aria}
            {...form.register("email")}
          />
        )}
      </FormField>
      <FormField id="preferredLocale" label={t("language")} hint={t("languageHint")}>
        {(aria) => (
          <NativeSelect {...aria} {...form.register("preferredLocale")}>
            {routing.locales.map((l) => (
              <option key={l} value={l}>
                {tLocale("locale", { locale: l })}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
