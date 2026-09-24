"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { changeOwnPasswordAction } from "@/lib/actions/staff.actions";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validators/staff";

export function ChangePasswordForm() {
  const t = useTranslations("ChangePassword");
  const tStaff = useTranslations("Staff");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const locale = useLocale();
  const form = useForm<ChangePasswordInput, unknown, z.output<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;
  // On success the action signs out and redirects to the login page.
  const { onSubmit, isPending } = useActionForm(form, (input) =>
    changeOwnPasswordAction(input, locale),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-sm gap-4">
      <FormField
        id="currentPassword"
        label={t("current")}
        error={errorText(errors.currentPassword?.message)}
      >
        {(aria) => (
          <Input
            type="password"
            autoComplete="current-password"
            {...aria}
            {...form.register("currentPassword")}
          />
        )}
      </FormField>
      <FormField
        id="newPassword"
        label={t("new")}
        hint={tStaff("passwordHint")}
        error={errorText(errors.newPassword?.message)}
      >
        {(aria) => (
          <Input
            type="password"
            autoComplete="new-password"
            {...aria}
            {...form.register("newPassword")}
          />
        )}
      </FormField>
      <FormField
        id="confirmPassword"
        label={t("confirm")}
        error={errorText(errors.confirmPassword?.message)}
      >
        {(aria) => (
          <Input
            type="password"
            autoComplete="new-password"
            {...aria}
            {...form.register("confirmPassword")}
          />
        )}
      </FormField>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
