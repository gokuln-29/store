"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ImageUploadField } from "@/components/admin/forms/image-upload";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { FormField } from "@/components/shared/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { deleteBannerAction, saveBannerAction } from "@/lib/actions/content.actions";
import { bannerFormSchema, type BannerFormInput } from "@/lib/validators/content";

export function BannerForm({ id, defaults }: { id: string | null; defaults: BannerFormInput }) {
  const t = useTranslations("Banners");
  const tCat = useTranslations("Categories");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();
  const form = useForm<BannerFormInput, unknown, z.output<typeof bannerFormSchema>>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const { onSubmit, isPending } = useActionForm(form, (input) => saveBannerAction(id, input), {
    successMessage: t("saved"),
    onSuccess: () => {
      router.push("/admin/content/banners");
      router.refresh();
    },
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-6">
        <LocalizedInput name="title" label={t("titleField")} requiredLocale="en" />
        <LocalizedInput name="subtitle" label={t("subtitle")} />
        <LocalizedInput name="ctaLabel" label={t("cta")} />
        <FormField id="linkUrl" label={t("link")} error={errorText(errors.linkUrl?.message)}>
          {(aria) => <Input {...aria} {...form.register("linkUrl")} />}
        </FormField>
        {(["imageUrl", "mobileImageUrl"] as const).map((name) => (
          <FormField
            key={name}
            id={name}
            label={name === "imageUrl" ? t("image") : t("mobileImage")}
            hint={name === "imageUrl" ? t("imageHint") : t("mobileImageHint")}
            error={errorText(errors[name]?.message)}
          >
            {(aria) => (
              <Controller
                control={form.control}
                name={name}
                render={({ field }) => (
                  <ImageUploadField
                    id={aria.id}
                    folder="banners"
                    value={field.value || null}
                    onChange={(url) => field.onChange(url ?? "")}
                    previewClassName={
                      name === "imageUrl" ? "w-48 aspect-[8/3] size-auto" : "size-20"
                    }
                    describedBy={aria["aria-describedby"]}
                  />
                )}
              />
            )}
          </FormField>
        ))}
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-medium">{t("schedule")}</legend>
          <FormField
            id="startsAt"
            label={t("startsAt")}
            error={errorText(errors.startsAt?.message)}
          >
            {(aria) => <Input type="date" {...aria} {...form.register("startsAt")} />}
          </FormField>
          <FormField id="endsAt" label={t("endsAt")} error={errorText(errors.endsAt?.message)}>
            {(aria) => <Input type="date" {...aria} {...form.register("endsAt")} />}
          </FormField>
          <FormField
            id="sortOrder"
            label={tCat("sortOrder")}
            error={errorText(errors.sortOrder?.message)}
          >
            {(aria) => <Input inputMode="numeric" {...aria} {...form.register("sortOrder")} />}
          </FormField>
        </fieldset>
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
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/content/banners">{tCommon("cancel")}</Link>
          </Button>
          {id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {tCat("remove")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      startDelete(async () => {
                        const result = await deleteBannerAction(id);
                        if (!result.ok) return void toast.error(errorText(result.error));
                        toast.success(t("deleted"));
                        router.push("/admin/content/banners");
                        router.refresh();
                      })
                    }
                  >
                    {tCat("remove")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
