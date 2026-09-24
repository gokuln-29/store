"use client";

import { useLocale, useTranslations } from "next-intl";
import { get, useFormContext } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { localize } from "@/lib/utils/localized";
import type { ProductFormInput } from "@/lib/validators/catalog-forms";

export type AttributeDef = {
  id: string;
  key: string;
  label: unknown;
  type: "TEXT" | "NUMBER" | "SELECT" | "COLOR";
  options: { value: string; label: unknown }[] | null;
  unit: string | null;
  isRequired: boolean;
};

/** Inputs generated from the selected category's attribute definitions. */
export function AttributeFields({ defs }: { defs: AttributeDef[] }) {
  const t = useTranslations("Products");
  const locale = useLocale();
  const errorText = useErrorText();
  const { register, formState } = useFormContext<ProductFormInput>();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {defs.map((def) => {
        const id = `attr-${def.key}`;
        const label = `${localize(def.label, locale)}${def.unit ? ` (${def.unit})` : ""}${def.isRequired ? " *" : ""}`;
        const error = errorText(
          get(formState.errors, `attributes.${def.key}`)?.message as string | undefined,
        );
        const field = register(`attributes.${def.key}`);
        return (
          <FormField key={def.id} id={id} label={label} error={error}>
            {(aria) =>
              def.type === "SELECT" || def.type === "COLOR" ? (
                <div className="flex items-center gap-2">
                  <NativeSelect {...aria} {...field}>
                    <option value="">{t("choose")}</option>
                    {(def.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {localize(o.label, locale) || o.value}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : (
                <Input
                  inputMode={def.type === "NUMBER" ? "decimal" : undefined}
                  {...aria}
                  {...field}
                />
              )
            }
          </FormField>
        );
      })}
    </div>
  );
}
