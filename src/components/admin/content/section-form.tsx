"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Controller,
  FormProvider,
  get,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import type { z } from "zod";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
import { LocalizedRichText } from "@/components/admin/forms/localized-rich-text";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { saveSectionAction } from "@/lib/actions/content.actions";
import { localize } from "@/lib/utils/localized";
import { sectionFormSchema, type SectionFormInput } from "@/lib/validators/content";

export type PickOption = { id: string; label: unknown; depth?: number };

function CheckList({
  name,
  options,
  legend,
  emptyText,
}: {
  name: string;
  options: PickOption[];
  legend: string;
  emptyText?: React.ReactNode;
}) {
  const locale = useLocale();
  const errorText = useErrorText();
  const { control, formState } = useFormContext();
  const error = errorText(get(formState.errors, name)?.message as string | undefined);
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.length === 0 && emptyText}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="grid max-h-72 gap-1 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
            {options.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-2 text-sm"
                style={{ paddingInlineStart: `${(o.depth ?? 0) * 1}rem` }}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={(field.value as string[]).includes(o.id)}
                  onChange={(e) =>
                    field.onChange(
                      e.target.checked
                        ? [...(field.value as string[]), o.id]
                        : (field.value as string[]).filter((x) => x !== o.id),
                    )
                  }
                />
                {localize(o.label, locale)}
              </label>
            ))}
          </div>
        )}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Testimonials() {
  const t = useTranslations("Content");
  const errorText = useErrorText();
  const { control, register, formState } = useFormContext<
    SectionFormInput & { type: "TESTIMONIALS" }
  >();
  const { fields, append, remove } = useFieldArray({ control, name: "config.items" });
  const listError = errorText(get(formState.errors, "config.items")?.message as string | undefined);
  return (
    <div className="grid gap-4">
      {fields.map((field, i) => (
        <Card key={field.id} className="py-4">
          <CardContent className="grid gap-4 px-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <LocalizedInput
                  name={`config.items.${i}.quote`}
                  label={t("quote")}
                  multiline
                  requiredLocale="en"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                aria-label={t("remove")}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                id={`t-author-${i}`}
                label={t("author")}
                error={errorText(get(formState.errors, `config.items.${i}.author`)?.message)}
              >
                {(aria) => <Input {...aria} {...register(`config.items.${i}.author`)} />}
              </FormField>
              <FormField id={`t-location-${i}`} label={t("location")}>
                {(aria) => <Input {...aria} {...register(`config.items.${i}.location`)} />}
              </FormField>
              <FormField id={`t-rating-${i}`} label={t("rating")}>
                {(aria) => (
                  <NativeSelect {...aria} {...register(`config.items.${i}.rating`)}>
                    {["5", "4", "3", "2", "1"].map((r) => (
                      <option key={r} value={r}>
                        {"★".repeat(Number(r))}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </div>
          </CardContent>
        </Card>
      ))}
      {listError && (
        <p role="alert" className="text-sm text-destructive">
          {listError}
        </p>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ quote: {}, author: "", location: "", rating: "5" })}
        >
          <Plus className="size-4" aria-hidden />
          {t("addTestimonial")}
        </Button>
      </div>
    </div>
  );
}

export function SectionForm({
  id,
  defaults,
  banners,
  categories,
}: {
  id: string | null;
  defaults: SectionFormInput;
  banners: PickOption[];
  categories: PickOption[];
}) {
  const t = useTranslations("Content");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const form = useForm<SectionFormInput, unknown, z.output<typeof sectionFormSchema>>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: defaults,
  });
  const { onSubmit, isPending } = useActionForm(form, (input) => saveSectionAction(id, input), {
    successMessage: t("saved"),
    onSuccess: () => {
      router.push("/admin/content");
      router.refresh();
    },
  });
  const type = defaults.type;
  const source = useWatch({ control: form.control, name: "config.source" as never }) as
    string | undefined;
  const err = (path: string) =>
    errorText(get(form.formState.errors, path)?.message as string | undefined);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-6">
        {type !== "OFFER_STRIP" && <LocalizedInput name="title" label={t("heading")} />}

        {type === "HERO_BANNER" && (
          <CheckList
            name="config.bannerIds"
            options={banners}
            legend={t("pickBanners")}
            emptyText={
              <p className="text-sm text-muted-foreground">
                {t("noBanners")}{" "}
                <Link href="/admin/content/banners/new" className="text-primary underline">
                  {t("manageBanners")}
                </Link>
              </p>
            }
          />
        )}
        {type === "FEATURED_CATEGORIES" && (
          <CheckList name="config.categoryIds" options={categories} legend={t("pickCategories")} />
        )}
        {type === "PRODUCT_CAROUSEL" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="source" label={t("source")}>
              {(aria) => (
                <NativeSelect {...aria} {...form.register("config.source" as never)}>
                  <option value="featured">{t("sourceFeatured")}</option>
                  <option value="newest">{t("sourceNewest")}</option>
                  <option value="category">{t("sourceCategory")}</option>
                </NativeSelect>
              )}
            </FormField>
            {source === "category" && (
              <FormField id="categoryId" label={t("category")} error={err("config.categoryId")}>
                {(aria) => (
                  <NativeSelect {...aria} {...form.register("config.categoryId" as never)}>
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {"— ".repeat(c.depth ?? 0)}
                        {localize(c.label, locale)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
            <FormField id="limit" label={t("limit")} error={err("config.limit")}>
              {(aria) => (
                <Input inputMode="numeric" {...aria} {...form.register("config.limit" as never)} />
              )}
            </FormField>
          </div>
        )}
        {type === "OFFER_STRIP" && (
          <>
            <LocalizedInput name="config.message" label={t("message")} requiredLocale="en" />
            <FormField id="linkUrl" label={t("link")} error={err("config.linkUrl")}>
              {(aria) => <Input {...aria} {...form.register("config.linkUrl" as never)} />}
            </FormField>
          </>
        )}
        {type === "TESTIMONIALS" && <Testimonials />}
        {type === "RICH_TEXT" && <LocalizedRichText name="config.html" label={t("text")} />}

        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <SwitchField
              id="isActive"
              label={t("visible")}
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
            <Link href="/admin/content">{tCommon("cancel")}</Link>
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
