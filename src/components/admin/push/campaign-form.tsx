"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ImageUploadField } from "@/components/admin/forms/image-upload";
import { LocalizedInput } from "@/components/admin/forms/localized-input";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { sendPushCampaignAction } from "@/lib/actions/push.actions";
import { pushCampaignSchema, type PushCampaignInput } from "@/lib/validators/push";

const EMPTY: PushCampaignInput = { title: {}, body: {}, imageUrl: "", url: "" };

/** Compose a push promotion, preview it, confirm the audience, send. */
export function CampaignForm({ audience }: { audience: number }) {
  const t = useTranslations("PushCampaigns");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<PushCampaignInput, unknown, z.output<typeof pushCampaignSchema>>({
    resolver: zodResolver(pushCampaignSchema),
    defaultValues: EMPTY,
  });
  const { errors } = form.formState;
  const preview = useWatch({ control: form.control });

  const send = () =>
    startTransition(async () => {
      const result = await sendPushCampaignAction(form.getValues());
      setConfirming(false);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as "title", { message });
        }
        toast.error(errorText(result.fieldErrors ? "validation" : result.error));
        return;
      }
      toast.success(t("queued", { count: result.data.audienceCount }));
      form.reset(EMPTY);
      router.refresh();
    });

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(() => setConfirming(true))}
        className="grid gap-6 lg:grid-cols-[1fr_18rem]"
      >
        <div className="grid content-start gap-5">
          <LocalizedInput
            name="title"
            label={t("titleField")}
            hint={t("titleHint")}
            requiredLocale="en"
          />
          <LocalizedInput
            name="body"
            label={t("bodyField")}
            hint={t("bodyHint")}
            requiredLocale="en"
            multiline
          />
          <FormField
            id="url"
            label={t("link")}
            hint={t("linkHint")}
            error={errorText(errors.url?.message)}
          >
            {(aria) => (
              // i18n-ignore: an example path, the same in every language
              <Input {...aria} placeholder="/c/sweets" {...form.register("url")} />
            )}
          </FormField>
          <FormField
            id="imageUrl"
            label={t("image")}
            hint={t("imageHint")}
            error={errorText(errors.imageUrl?.message)}
          >
            {(aria) => (
              <Controller
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <ImageUploadField
                    id={aria.id}
                    folder="banners"
                    value={field.value || null}
                    onChange={(url) => field.onChange(url ?? "")}
                    previewClassName="w-48 aspect-[2/1] size-auto"
                    describedBy={aria["aria-describedby"]}
                  />
                )}
              />
            )}
          </FormField>
          <div>
            <Button type="submit" disabled={isPending || audience === 0}>
              {t("send", { count: audience })}
            </Button>
            {audience === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">{t("noAudience")}</p>
            )}
          </div>
        </div>

        <aside aria-label={t("preview")} className="grid h-fit gap-2">
          <p className="text-sm font-medium">{t("preview")}</p>
          <div className="flex gap-3 rounded-xl border bg-muted/40 p-3 shadow-sm">
            <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">{preview.title?.en || t("titleField")}</p>
              <p className="line-clamp-3 text-muted-foreground">
                {preview.body?.en || t("bodyField")}
              </p>
            </div>
          </div>
        </aside>

        <AlertDialog open={confirming} onOpenChange={(o) => !isPending && setConfirming(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirmBody", { count: audience })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                {t("send", { count: audience })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </FormProvider>
  );
}
