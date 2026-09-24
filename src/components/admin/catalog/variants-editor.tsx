"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { get, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useErrorText } from "@/hooks/use-error-text";
import { slugify, toKey } from "@/lib/utils/slug";
import { comboKey, skuPrefixFromSlug, suggestSku, syncVariants } from "@/lib/utils/variants";
import type { ProductFormInput } from "@/lib/validators/catalog-forms";

type VariantInput = ProductFormInput["variants"][number];

function OptionValues({ optionIndex }: { optionIndex: number }) {
  const t = useTranslations("Variants");
  const tCat = useTranslations("Categories");
  const { control, register } = useFormContext<ProductFormInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `options.${optionIndex}.values`,
  });
  const [draft, setDraft] = useState("");
  const [showTranslations, setShowTranslations] = useState(false);

  function add() {
    const values = draft
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const value of values) {
      if (!fields.some((f) => f.value === value)) append({ value, label: {} });
    }
    setDraft("");
  }

  return (
    <div className="grid gap-2">
      <Label>{t("values")}</Label>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((field, i) => (
          <Badge key={field.id} variant="secondary" className="gap-1 py-1 pr-1 text-sm">
            {field.value}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`${tCat("remove")}: ${field.value}`}
              className="rounded p-0.5 hover:bg-background"
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t("valuePlaceholder")}
          aria-label={t("addValue")}
          className="max-w-xs"
        />
        <Button type="button" variant="outline" onClick={add}>
          {t("addValue")}
        </Button>
      </div>
      {fields.length > 0 && (
        <div>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => setShowTranslations((s) => !s)}
          >
            {t("translations")}
          </Button>
          {showTranslations && (
            <div className="mt-2 grid gap-1">
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2">
                  <span className="truncate text-sm">{field.value}</span>
                  <Input
                    lang="ta"
                    placeholder="தமிழ்"
                    aria-label={`${field.value} தமிழ்`}
                    className="h-8"
                    {...register(`options.${optionIndex}.values.${i}.label.ta`)}
                  />
                  <Input
                    lang="kn"
                    placeholder="ಕನ್ನಡ"
                    aria-label={`${field.value} ಕನ್ನಡ`}
                    className="h-8"
                    {...register(`options.${optionIndex}.values.${i}.label.kn`)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Options (size, colour, …) and the variant matrix generated from them. */
export function VariantsEditor({ skuPrefix }: { skuPrefix: string }) {
  const t = useTranslations("Variants");
  const errorText = useErrorText();
  const { control, register, setValue, getValues, formState, clearErrors } =
    useFormContext<ProductFormInput>();
  const options = useFieldArray({ control, name: "options" });
  const variants = useFieldArray({ control, name: "variants" });
  const watchedOptions = useWatch({ control, name: "options" });
  const watchedVariants = useWatch({ control, name: "variants" });
  const [bulk, setBulk] = useState({ price: "", stock: "" });

  // Effective option keys: saved key, or derived from the English name for new options.
  const effective = useMemo(
    () =>
      (watchedOptions ?? []).map((o) => ({
        key: o.key || toKey(o.label?.en ?? "", "option"),
        values: (o.values ?? []).filter((v) => v.value).map((v) => ({ value: v.value })),
      })),
    [watchedOptions],
  );
  const signature = JSON.stringify(effective);

  // Rebuild the variant rows whenever the set of combinations changes.
  useEffect(() => {
    const current = getValues("variants") ?? [];
    const withValues = effective.filter((o) => o.values.length > 0);
    const next = syncVariants<VariantInput>(withValues, current, (values) => ({
      id: "",
      optionValues: values,
      sku: suggestSku(
        skuPrefix ||
          skuPrefixFromSlug(getValues("slug") || slugify(getValues("name.en") ?? "", "sku")),
        values,
      ),
      price: current[0]?.price ?? "",
      compareAtPrice: current[0]?.compareAtPrice ?? "",
      costPrice: "",
      stock: "0",
      lowStockThreshold: "5",
      weightGrams: current[0]?.weightGrams ?? "",
      isActive: true,
    }));
    const same =
      next.length === current.length &&
      next.every((v, i) => comboKey(v.optionValues) === comboKey(current[i]!.optionValues));
    if (!same) {
      variants.replace(next);
      // Errors from a previous submit refer to the old rows.
      clearErrors("variants");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when combinations change
  }, [signature]);

  const variantError = (i: number, field: keyof VariantInput) =>
    errorText(get(formState.errors, `variants.${i}.${field}`)?.message as string | undefined);
  const listError = errorText(
    (get(formState.errors, "variants")?.message ?? get(formState.errors, "options")?.message) as
      string | undefined,
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        {options.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 rounded-md border p-3">
            <div className="flex items-end gap-2">
              <div className="grid flex-1 gap-1 sm:grid-cols-3">
                <div className="grid gap-1 sm:col-span-3">
                  <Label htmlFor={`option-${index}-en`}>{t("optionName")}</Label>
                </div>
                <Input
                  id={`option-${index}-en`}
                  lang="en"
                  placeholder="English"
                  {...register(`options.${index}.label.en`)}
                />
                <Input
                  lang="ta"
                  placeholder="தமிழ்"
                  aria-label={`${t("optionName")} தமிழ்`}
                  {...register(`options.${index}.label.ta`)}
                />
                <Input
                  lang="kn"
                  placeholder="ಕನ್ನಡ"
                  aria-label={`${t("optionName")} ಕನ್ನಡ`}
                  {...register(`options.${index}.label.kn`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => options.remove(index)}
                aria-label={t("removeOption")}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden />
              </Button>
            </div>
            <OptionValues optionIndex={index} />
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={options.fields.length >= 3}
            onClick={() => options.append({ key: "", label: { en: "" }, values: [] })}
          >
            <Plus className="size-4" aria-hidden />
            {t("addOption")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("maxOptions")}</span>
        </div>
      </div>

      {variants.fields.length > 1 && (
        <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/50 p-3">
          <div className="grid gap-1">
            <Label htmlFor="bulk-price" className="text-xs">
              {t("price")}
            </Label>
            <Input
              id="bulk-price"
              inputMode="decimal"
              className="h-8 w-28"
              value={bulk.price}
              onChange={(e) => setBulk((b) => ({ ...b, price: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="bulk-stock" className="text-xs">
              {t("stock")}
            </Label>
            <Input
              id="bulk-stock"
              inputMode="numeric"
              className="h-8 w-24"
              value={bulk.stock}
              onChange={(e) => setBulk((b) => ({ ...b, stock: e.target.value }))}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              variants.fields.forEach((_, i) => {
                if (bulk.price) setValue(`variants.${i}.price`, bulk.price, { shouldDirty: true });
                if (bulk.stock) setValue(`variants.${i}.stock`, bulk.stock, { shouldDirty: true });
              });
            }}
          >
            {t("applyAll")}
          </Button>
        </div>
      )}

      {listError && (
        <p role="alert" className="text-sm text-destructive">
          {listError}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("variant")}</th>
              <th className="px-2 py-2 font-medium">{t("sku")}</th>
              <th className="px-2 py-2 font-medium">{t("price")}</th>
              <th className="px-2 py-2 font-medium">{t("mrp")}</th>
              <th className="px-2 py-2 font-medium">{t("stock")}</th>
              <th className="px-2 py-2 font-medium">{t("weight")}</th>
              <th className="px-2 py-2 font-medium">{t("active")}</th>
            </tr>
          </thead>
          <tbody>
            {variants.fields.map((field, i) => {
              const label = Object.values(field.optionValues).join(" / ");
              const cell = (
                name: keyof VariantInput,
                props: React.ComponentProps<typeof Input> = {},
              ) => {
                const error = variantError(i, name);
                return (
                  <td className="px-2 py-2 align-top">
                    <Input
                      aria-label={`${label || t("default")} · ${t(name === "compareAtPrice" ? "mrp" : name === "weightGrams" ? "weight" : (name as "sku" | "price" | "stock"))}`}
                      aria-invalid={Boolean(error)}
                      className="h-8"
                      {...props}
                      {...register(`variants.${i}.${name}` as const)}
                    />
                    {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
                  </td>
                );
              };
              return (
                <tr key={field.id} className="border-t">
                  <td className="px-3 py-2 align-top font-medium whitespace-nowrap">
                    {label || t("default")}
                  </td>
                  {cell("sku", { className: "h-8 w-44 font-mono uppercase" })}
                  {cell("price", { inputMode: "decimal", className: "h-8 w-24" })}
                  {cell("compareAtPrice", { inputMode: "decimal", className: "h-8 w-24" })}
                  {cell("stock", { inputMode: "numeric", className: "h-8 w-20" })}
                  {cell("weightGrams", { inputMode: "numeric", className: "h-8 w-20" })}
                  <td className="px-2 py-2 align-top">
                    <Switch
                      checked={Boolean(watchedVariants?.[i]?.isActive)}
                      onCheckedChange={(checked) =>
                        setValue(`variants.${i}.isActive`, checked, { shouldDirty: true })
                      }
                      aria-label={`${label || t("default")} · ${t("active")}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
