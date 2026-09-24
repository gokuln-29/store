"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
import { LocalizedRichText } from "@/components/admin/forms/localized-rich-text";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { saveProductAction } from "@/lib/actions/catalog.actions";
import { localize } from "@/lib/utils/localized";
import { skuPrefixFromSlug } from "@/lib/utils/variants";
import { productFormSchema, type ProductFormInput } from "@/lib/validators/catalog-forms";
import { AttributeFields, type AttributeDef } from "./attribute-fields";
import { ProductImages } from "./product-images";
import { VariantsEditor } from "./variants-editor";

export type CategoryChoice = {
  id: string;
  name: unknown;
  parentId: string | null;
  depth: number;
  attributes: AttributeDef[];
};

export function ProductForm({
  id,
  defaults,
  categories,
  savedSlug,
}: {
  id: string | null;
  defaults: ProductFormInput;
  categories: CategoryChoice[];
  savedSlug: string | null;
}) {
  const t = useTranslations("Products");
  const tCat = useTranslations("Categories");
  const tCommon = useTranslations("Common");
  const tVariants = useTranslations("Variants");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const form = useForm<ProductFormInput, unknown, z.output<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaults,
  });
  const { errors, isDirty } = form.formState;
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const category = categories.find((c) => c.id === categoryId);
  const { onSubmit, isPending } = useActionForm(form, (input) => saveProductAction(id, input), {
    successMessage: t("saved"),
    onSuccess: (data) => {
      form.reset(form.getValues());
      if (!id) router.replace(`/admin/products/${data.id}`);
      else router.refresh();
    },
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6 pb-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid min-w-0 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("basics")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                <LocalizedInput name="name" label={t("name")} requiredLocale="en" />
                <LocalizedInput
                  name="shortDescription"
                  label={t("shortDescription")}
                  hint={t("shortDescriptionHint")}
                  multiline
                />
                <LocalizedRichText name="description" label={t("descriptionField")} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("media")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductImages />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("attributes")}</CardTitle>
              </CardHeader>
              <CardContent>
                {!category ? (
                  <p className="text-sm text-muted-foreground">{t("attributesPickCategory")}</p>
                ) : category.attributes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("attributesEmpty")}</p>
                ) : (
                  <AttributeFields key={category.id} defs={category.attributes} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tVariants("title")}</CardTitle>
                <CardDescription>{tVariants("hint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <VariantsEditor skuPrefix={savedSlug ? skuPrefixFromSlug(savedSlug) : ""} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tCat("seo")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                <FormField
                  id="slug"
                  label={tCat("slug")}
                  hint={tCat("slugHint")}
                  error={errorText(errors.slug?.message)}
                >
                  {(aria) => <Input className="font-mono" {...aria} {...form.register("slug")} />}
                </FormField>
                <LocalizedInput name="metaTitle" label={tCat("metaTitle")} />
                <LocalizedInput name="metaDescription" label={tCat("metaDescription")} multiline />
              </CardContent>
            </Card>
          </div>

          <div className="grid h-fit gap-6 lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle>{t("organization")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                <FormField id="status" label={t("status")} hint={t("statusHint")}>
                  {(aria) => (
                    <NativeSelect {...aria} {...form.register("status")}>
                      {(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((s) => (
                        <option key={s} value={s}>
                          {t(`status${s}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField
                  id="categoryId"
                  label={t("category")}
                  error={errorText(errors.categoryId?.message)}
                >
                  {(aria) => (
                    <NativeSelect {...aria} {...form.register("categoryId")}>
                      <option value="" disabled>
                        {t("selectCategory")}
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {"— ".repeat(c.depth)}
                          {localize(c.name, locale)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField id="brand" label={t("brand")} error={errorText(errors.brand?.message)}>
                  {(aria) => <Input {...aria} {...form.register("brand")} />}
                </FormField>
                <Controller
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <SwitchField
                      id="isFeatured"
                      label={t("featured")}
                      hint={t("featuredHint")}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("pricingTax")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  id="taxRateBps"
                  label={tCat("taxRate")}
                  error={errorText(errors.taxRateBps?.message)}
                >
                  {(aria) => (
                    <Input inputMode="decimal" {...aria} {...form.register("taxRateBps")} />
                  )}
                </FormField>
                <FormField
                  id="hsnCode"
                  label={tCat("hsnCode")}
                  error={errorText(errors.hsnCode?.message)}
                >
                  {(aria) => <Input inputMode="numeric" {...aria} {...form.register("hsnCode")} />}
                </FormField>
                <p className="col-span-2 -mt-2 text-xs text-muted-foreground">{t("taxHint")}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur md:left-60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3 md:px-8">
            {isDirty && (
              <span className="mr-auto text-sm text-muted-foreground">{t("unsaved")}</span>
            )}
            {savedSlug && defaults.status === "PUBLISHED" && (
              <Button asChild variant="ghost">
                <Link href={`/products/${savedSlug}`} target="_blank">
                  <ExternalLink className="size-4" aria-hidden />
                  {t("viewInStore")}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/admin/products">{tCommon("cancel")}</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon("saving") : tCommon("save")}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
