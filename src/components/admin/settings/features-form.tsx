"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/hooks/use-action-form";
import { updateFeatureSettingsAction } from "@/lib/actions/settings.actions";
import { FEATURES } from "@/lib/features";
import { featureSettingsSchema, type FeatureSettingsInput } from "@/lib/validators/settings";

/** One switch per optional feature; turning one off hides it everywhere. */
export function FeatureSettingsForm({ defaults }: { defaults: FeatureSettingsInput }) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const form = useForm<FeatureSettingsInput, unknown, z.output<typeof featureSettingsSchema>>({
    resolver: zodResolver(featureSettingsSchema),
    defaultValues: defaults,
  });
  const { onSubmit, isPending } = useActionForm(form, updateFeatureSettingsAction, {
    successMessage: t("saved"),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-6">
      <p className="text-sm text-muted-foreground">{t("featuresHint")}</p>
      {FEATURES.map((feature) => (
        <Controller
          key={feature}
          control={form.control}
          name={feature}
          render={({ field }) => (
            <SwitchField
              id={`feature-${feature}`}
              label={t(`feature.${feature}.label`)}
              hint={t(`feature.${feature}.hint`)}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      ))}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
