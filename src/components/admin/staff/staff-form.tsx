"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { createStaffAction } from "@/lib/actions/staff.actions";
import { createStaffSchema, type CreateStaffInput } from "@/lib/validators/staff";

export function StaffForm() {
  const t = useTranslations("Staff");
  const tRoles = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const form = useForm<CreateStaffInput, unknown, z.output<typeof createStaffSchema>>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { name: "", email: "", role: "STAFF", password: "" },
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, createStaffAction, {
    successMessage: t("created"),
    onSuccess: () => router.push("/admin/staff"),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
      <FormField id="name" label={t("name")} error={errorText(errors.name?.message)}>
        {(aria) => <Input autoComplete="off" {...aria} {...form.register("name")} />}
      </FormField>
      <FormField id="email" label={t("email")} error={errorText(errors.email?.message)}>
        {(aria) => <Input type="email" autoComplete="off" {...aria} {...form.register("email")} />}
      </FormField>
      <FormField id="role" label={t("role")} hint={t("roleHint")}>
        {(aria) => (
          <NativeSelect {...aria} {...form.register("role")}>
            <option value="STAFF">{tRoles("STAFF")}</option>
            <option value="OWNER">{tRoles("OWNER")}</option>
          </NativeSelect>
        )}
      </FormField>
      <FormField
        id="password"
        label={t("password")}
        hint={t("passwordHint")}
        error={errorText(errors.password?.message)}
      >
        {(aria) => (
          <Input
            type="password"
            autoComplete="new-password"
            {...aria}
            {...form.register("password")}
          />
        )}
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/staff">{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
