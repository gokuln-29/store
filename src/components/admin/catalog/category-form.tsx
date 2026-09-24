"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";
import { ImageUploadField } from "@/components/admin/forms/image-upload";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { saveCategoryAction } from "@/lib/actions/catalog.actions";
import { categoryFormSchema, type CategoryFormInput } from "@/lib/validators/catalog-forms";
import { AttributeBuilder } from "./attribute-builder";

export type ParentOption = { id: string; label: string; depth: number };

export function CategoryForm({
  id,
  defaults,
  parents,
  existingKeys,
}: {
  id: string | null;
  defaults: CategoryFormInput;
  parents: ParentOption[];
  existingKeys: Record<string, string>;
}) {
  const t = useTranslations("Categories");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const form = useForm<CategoryFormInput, unknown, z.output<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, (input) => saveCategoryAction(id, input), {
    successMessage: t("saved"),
    onSuccess: () => {
      router.push("/admin/categories");
      router.refresh();
    },
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6 pb-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle>{t("details")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <LocalizedInput name="name" label={t("name")} requiredLocale="en" />
              <LocalizedInput name="description" label={t("descriptionField")} multiline />
              <FormField
                id="slug"
                label={t("slug")}
                hint={t("slugHint")}
                error={errorText(errors.slug?.message)}
              >
                {(aria) => <Input className="font-mono" {...aria} {...form.register("slug")} />}
              </FormField>
            </CardContent>
          </Card>

          <div className="grid h-fit gap-6">
            <Card>
              <CardContent className="grid gap-5">
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <SwitchField
                      id="isActive"
                      label={t("active")}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FormField
                  id="parentId"
                  label={t("parent")}
                  error={errorText(errors.parentId?.message)}
                >
                  {(aria) => (
                    <NativeSelect {...aria} {...form.register("parentId")}>
                      <option value="">{t("noParent")}</option>
                      {parents.map((p) => (
                        <option key={p.id} value={p.id}>
                          {"— ".repeat(p.depth)}
                          {p.label}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField id="imageUrl" label={t("image")}>
                  {(aria) => (
                    <Controller
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <ImageUploadField
                          id={aria.id}
                          folder="categories"
                          value={field.value || null}
                          onChange={(url) => field.onChange(url ?? "")}
                        />
                      )}
                    />
                  )}
                </FormField>
                <FormField
                  id="sortOrder"
                  label={t("sortOrder")}
                  hint={t("sortOrderHint")}
                  error={errorText(errors.sortOrder?.message)}
                >
                  {(aria) => (
                    <Input
                      inputMode="numeric"
                      className="max-w-[8rem]"
                      {...aria}
                      {...form.register("sortOrder")}
                    />
                  )}
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    id="taxRateBps"
                    label={t("taxRate")}
                    error={errorText(errors.taxRateBps?.message)}
                  >
                    {(aria) => (
                      <Input inputMode="decimal" {...aria} {...form.register("taxRateBps")} />
                    )}
                  </FormField>
                  <FormField
                    id="hsnCode"
                    label={t("hsnCode")}
                    error={errorText(errors.hsnCode?.message)}
                  >
                    {(aria) => (
                      <Input inputMode="numeric" {...aria} {...form.register("hsnCode")} />
                    )}
                  </FormField>
                </div>
                <p className="-mt-3 text-xs text-muted-foreground">{t("taxRateHint")}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("attributes")}</CardTitle>
            <CardDescription>{t("attributesHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AttributeBuilder existingKeys={existingKeys} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("seo")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <LocalizedInput name="metaTitle" label={t("metaTitle")} />
            <LocalizedInput name="metaDescription" label={t("metaDescription")} multiline />
          </CardContent>
        </Card>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur md:left-60">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-3 md:px-8">
            <Button asChild variant="outline">
              <Link href="/admin/categories">{tCommon("cancel")}</Link>
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
