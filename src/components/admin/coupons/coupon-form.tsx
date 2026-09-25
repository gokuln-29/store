"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { saveCouponAction, searchCouponProductsAction } from "@/lib/actions/coupons.actions";
import { localize } from "@/lib/utils/localized";
import { couponFormSchema, type CouponFormInput } from "@/lib/validators/coupons";

type Option = { id: string; label: string; depth?: number };

export function CouponForm({
  id,
  defaults,
  categories,
  selectedProducts,
}: {
  id: string | null;
  defaults: CouponFormInput;
  categories: Option[];
  selectedProducts: Option[];
}) {
  const t = useTranslations("Coupons");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const form = useForm<CouponFormInput, unknown, z.output<typeof couponFormSchema>>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });
  const { onSubmit, isPending } = useActionForm(form, (input) => saveCouponAction(id, input), {
    successMessage: t("saved"),
    onSuccess: () => {
      router.push("/admin/coupons");
      router.refresh();
    },
  });

  const [productNames, setProductNames] = useState(
    () => new Map(selectedProducts.map((p) => [p.id, p.label])),
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  const [searching, startSearch] = useTransition();
  const search = () =>
    startSearch(async () => {
      const r = await searchCouponProductsAction(query);
      if (r.ok)
        setResults(r.data.map((p) => ({ id: p.id, label: localize(p.name, locale) || p.slug })));
    });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="code"
            label={t("code")}
            hint={t("codeHint")}
            error={errorText(errors.code?.message)}
          >
            {(aria) => (
              <Input
                {...aria}
                className="uppercase"
                autoComplete="off"
                {...form.register("code")}
              />
            )}
          </FormField>
          <FormField id="type" label={t("type")}>
            {(aria) => (
              <NativeSelect {...aria} {...form.register("type")}>
                <option value="PERCENTAGE">{t("types.PERCENTAGE")}</option>
                <option value="FLAT">{t("types.FLAT")}</option>
              </NativeSelect>
            )}
          </FormField>
          {type === "PERCENTAGE" ? (
            <FormField id="percent" label={t("percent")} error={errorText(errors.percent?.message)}>
              {(aria) => <Input {...aria} inputMode="decimal" {...form.register("percent")} />}
            </FormField>
          ) : (
            <FormField id="amount" label={t("amount")} error={errorText(errors.amount?.message)}>
              {(aria) => <Input {...aria} inputMode="decimal" {...form.register("amount")} />}
            </FormField>
          )}
          {type === "PERCENTAGE" && (
            <FormField
              id="maxDiscount"
              label={t("maxDiscount")}
              hint={t("optional")}
              error={errorText(errors.maxDiscount?.message)}
            >
              {(aria) => <Input {...aria} inputMode="decimal" {...form.register("maxDiscount")} />}
            </FormField>
          )}
          <FormField
            id="minCartValue"
            label={t("minCartValue")}
            hint={t("optional")}
            error={errorText(errors.minCartValue?.message)}
          >
            {(aria) => <Input {...aria} inputMode="decimal" {...form.register("minCartValue")} />}
          </FormField>
          <FormField
            id="usageLimit"
            label={t("usageLimit")}
            hint={t("usageLimitHint")}
            error={errorText(errors.usageLimit?.message)}
          >
            {(aria) => <Input {...aria} inputMode="numeric" {...form.register("usageLimit")} />}
          </FormField>
          <FormField
            id="perUserLimit"
            label={t("perUserLimit")}
            hint={t("perUserLimitHint")}
            error={errorText(errors.perUserLimit?.message)}
          >
            {(aria) => <Input {...aria} inputMode="numeric" {...form.register("perUserLimit")} />}
          </FormField>
          <FormField
            id="startsAt"
            label={t("startsAt")}
            hint={t("optional")}
            error={errorText(errors.startsAt?.message)}
          >
            {(aria) => <Input {...aria} type="date" {...form.register("startsAt")} />}
          </FormField>
          <FormField
            id="endsAt"
            label={t("endsAt")}
            hint={t("endsAtHint")}
            error={errorText(errors.endsAt?.message)}
          >
            {(aria) => <Input {...aria} type="date" {...form.register("endsAt")} />}
          </FormField>
        </div>

        <LocalizedInput name="description" label={t("description")} hint={t("descriptionHint")} />

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{t("categories")}</legend>
          <p className="text-xs text-muted-foreground">{t("restrictHint")}</p>
          <Controller
            control={form.control}
            name="categoryIds"
            render={({ field }) => (
              <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2"
                    style={{ paddingInlineStart: `${(c.depth ?? 0) * 1}rem` }}
                  >
                    <Checkbox
                      id={`cat-${c.id}`}
                      checked={field.value.includes(c.id)}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on ? [...field.value, c.id] : field.value.filter((v) => v !== c.id),
                        )
                      }
                    />
                    <Label htmlFor={`cat-${c.id}`} className="font-normal">
                      {c.label}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          />
        </fieldset>

        <Controller
          control={form.control}
          name="productIds"
          render={({ field }) => (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">{t("products")}</legend>
              {field.value.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {field.value.map((pid) => (
                    <li key={pid}>
                      <Badge variant="secondary" className="gap-1 pr-1">
                        {productNames.get(pid) ?? pid}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-background"
                          aria-label={t("removeProduct", { name: productNames.get(pid) ?? pid })}
                          onClick={() => field.onChange(field.value.filter((v) => v !== pid))}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      search();
                    }
                  }}
                  placeholder={t("searchProducts")}
                  aria-label={t("searchProducts")}
                />
                <Button type="button" variant="outline" onClick={search} disabled={searching}>
                  <Search aria-hidden />
                  {t("search")}
                </Button>
              </div>
              {results.length > 0 && (
                <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 text-sm">
                  {results.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{r.label}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={field.value.includes(r.id)}
                        onClick={() => {
                          setProductNames((m) => new Map(m).set(r.id, r.label));
                          field.onChange([...field.value, r.id]);
                        }}
                      >
                        {t("addProduct")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}
        />

        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <SwitchField
              id="isActive"
              label={t("active")}
              hint={t("activeHint")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/coupons">{tCommon("cancel")}</Link>
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
