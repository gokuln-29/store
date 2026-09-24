"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { get, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ColorInput } from "@/components/admin/forms/color-input";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErrorText } from "@/hooks/use-error-text";
import type { CategoryFormInput } from "@/lib/validators/catalog-forms";

const TYPES = ["TEXT", "NUMBER", "SELECT", "COLOR"] as const;

function ChoicesEditor({ index }: { index: number }) {
  const t = useTranslations("Categories");
  const errorText = useErrorText();
  const { control, register, formState, setValue } = useFormContext<CategoryFormInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `attributes.${index}.options`,
  });
  const type = useWatch({ control, name: `attributes.${index}.type` });
  const values = useWatch({ control, name: `attributes.${index}.options` });
  const listError = get(formState.errors, `attributes.${index}.options`)?.message as
    string | undefined;

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{t("choices")}</legend>
      {fields.map((field, i) => {
        const valueError = get(formState.errors, `attributes.${index}.options.${i}.value`)
          ?.message as string | undefined;
        return (
          <div
            key={field.id}
            className="grid gap-2 rounded-md border p-2 sm:grid-cols-[10rem_1fr_1fr_1fr_auto] sm:items-start"
          >
            <div className="grid gap-1">
              {type === "COLOR" ? (
                <ColorInput
                  id={`attr-${index}-opt-${i}`}
                  value={values?.[i]?.value ?? ""}
                  onChange={(v) =>
                    setValue(`attributes.${index}.options.${i}.value`, v, { shouldDirty: true })
                  }
                  invalid={Boolean(valueError)}
                />
              ) : (
                <Input
                  aria-label={t("choiceValue")}
                  placeholder={t("choiceValue")}
                  {...register(`attributes.${index}.options.${i}.value`)}
                />
              )}
              {valueError && <p className="text-xs text-destructive">{errorText(valueError)}</p>}
            </div>
            <Input
              aria-label="English"
              placeholder="English"
              lang="en"
              {...register(`attributes.${index}.options.${i}.label.en`)}
            />
            <Input
              aria-label="தமிழ்"
              placeholder="தமிழ்"
              lang="ta"
              {...register(`attributes.${index}.options.${i}.label.ta`)}
            />
            <Input
              aria-label="ಕನ್ನಡ"
              placeholder="ಕನ್ನಡ"
              lang="kn"
              {...register(`attributes.${index}.options.${i}.label.kn`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label={t("remove")}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        );
      })}
      {listError && <p className="text-sm text-destructive">{errorText(listError)}</p>}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ value: type === "COLOR" ? "#000000" : "", label: {} })}
        >
          <Plus className="size-4" aria-hidden />
          {t("addChoice")}
        </Button>
      </div>
    </fieldset>
  );
}

export function AttributeBuilder({ existingKeys }: { existingKeys: Record<string, string> }) {
  const t = useTranslations("Categories");
  const { control, register } = useFormContext<CategoryFormInput>();
  const { fields, append, remove, move } = useFieldArray({ control, name: "attributes" });
  const attributes = useWatch({ control, name: "attributes" });

  return (
    <div className="grid gap-4">
      {fields.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("removeAttributeWarning")}</p>
      )}
      {fields.map((field, index) => {
        const type = attributes?.[index]?.type;
        const id = attributes?.[index]?.id;
        const key = id ? existingKeys[id] : undefined;
        return (
          <Card key={field.id} className="py-4">
            <CardContent className="grid gap-4 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="grid flex-1 gap-1">
                  <LocalizedInput
                    name={`attributes.${index}.label`}
                    label={t("attributeLabel")}
                    requiredLocale="en"
                  />
                  {key && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {t("attributeKey", { key })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={t("moveUp")}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={t("moveDown")}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label={t("remove")}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor={`attr-${index}-type`}>{t("attributeType")}</Label>
                  <NativeSelect id={`attr-${index}-type`} {...register(`attributes.${index}.type`)}>
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`type${type}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {type === "NUMBER" && (
                  <div className="grid gap-2">
                    <Label htmlFor={`attr-${index}-unit`}>{t("unit")}</Label>
                    <Input id={`attr-${index}-unit`} {...register(`attributes.${index}.unit`)} />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-6">
                {(["isRequired", "isFilterable"] as const).map((flag) => (
                  <label key={flag} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      {...register(`attributes.${index}.${flag}`)}
                    />
                    {flag === "isRequired" ? t("required") : t("filterable")}
                  </label>
                ))}
              </div>
              {(type === "SELECT" || type === "COLOR") && <ChoicesEditor index={index} />}
            </CardContent>
          </Card>
        );
      })}
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({
              id: "",
              key: "",
              label: {},
              type: "TEXT",
              unit: "",
              isRequired: false,
              isFilterable: false,
              options: [],
            })
          }
        >
          <Plus className="size-4" aria-hidden />
          {t("addAttribute")}
        </Button>
      </div>
    </div>
  );
}
