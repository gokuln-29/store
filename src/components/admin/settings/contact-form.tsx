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
import { updateContactSettingsAction } from "@/lib/actions/settings.actions";
import { INDIAN_STATES } from "@/lib/constants/indian-states";
import { contactSettingsSchema, type ContactSettingsInput } from "@/lib/validators/settings";

export function ContactSettingsForm({ defaults }: { defaults: ContactSettingsInput }) {
  const t = useTranslations("Settings");
  const tAddr = useTranslations("Addresses");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const form = useForm<ContactSettingsInput, unknown, z.output<typeof contactSettingsSchema>>({
    resolver: zodResolver(contactSettingsSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, updateContactSettingsAction, {
    successMessage: t("saved"),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="contactEmail"
          label={t("contactEmail")}
          error={errorText(errors.contactEmail?.message)}
        >
          {(aria) => <Input type="email" {...aria} {...form.register("contactEmail")} />}
        </FormField>
        <FormField
          id="contactPhone"
          label={t("contactPhone")}
          error={errorText(errors.contactPhone?.message)}
        >
          {(aria) => <Input type="tel" {...aria} {...form.register("contactPhone")} />}
        </FormField>
        <FormField
          id="whatsappNumber"
          label={t("whatsapp")}
          error={errorText(errors.whatsappNumber?.message)}
        >
          {(aria) => (
            <Input type="tel" inputMode="numeric" {...aria} {...form.register("whatsappNumber")} />
          )}
        </FormField>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-base font-semibold">{t("businessAddress")}</legend>
        <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
          {t("businessAddressHint")}
        </p>
        <FormField
          id="address.line1"
          label={tAddr("line1")}
          className="sm:col-span-2"
          error={errorText(errors.address?.line1?.message)}
        >
          {(aria) => <Input {...aria} {...form.register("address.line1")} />}
        </FormField>
        <FormField
          id="address.line2"
          label={`${tAddr("line2")} (${tCommon("optional")})`}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} {...form.register("address.line2")} />}
        </FormField>
        <FormField
          id="address.city"
          label={tAddr("city")}
          error={errorText(errors.address?.city?.message)}
        >
          {(aria) => <Input {...aria} {...form.register("address.city")} />}
        </FormField>
        <FormField
          id="address.pincode"
          label={tAddr("pincode")}
          error={errorText(errors.address?.pincode?.message)}
        >
          {(aria) => (
            <Input
              inputMode="numeric"
              maxLength={6}
              {...aria}
              {...form.register("address.pincode")}
            />
          )}
        </FormField>
        <FormField
          id="address.stateCode"
          label={tAddr("state")}
          error={errorText(errors.address?.stateCode?.message)}
        >
          {(aria) => (
            <NativeSelect {...aria} {...form.register("address.stateCode")}>
              <option value="">{tAddr("statePlaceholder")}</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-base font-semibold">{t("social")}</legend>
        {(["instagram", "facebook", "youtube", "x"] as const).map((network) => (
          <FormField
            key={network}
            id={`socialLinks.${network}`}
            label={network === "x" ? "X" : network.charAt(0).toUpperCase() + network.slice(1)}
            error={errorText(errors.socialLinks?.[network]?.message)}
          >
            {(aria) => (
              <Input
                type="url"
                // i18n-ignore: URL scheme hint
                placeholder="https://"
                {...aria}
                {...form.register(`socialLinks.${network}`)}
              />
            )}
          </FormField>
        ))}
      </fieldset>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
