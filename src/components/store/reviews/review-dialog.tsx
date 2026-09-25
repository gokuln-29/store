"use client";

import { ImagePlus, Star, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { submitReviewAction } from "@/lib/actions/reviews.actions";
import { isLocalUpload } from "@/lib/utils/images";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 3;

/** Rate and review a delivered product (reviews appear after the store approves them). */
export function ReviewDialog({
  productId,
  productName,
  photosEnabled,
}: {
  productId: string;
  productName: string;
  photosEnabled: boolean;
}) {
  const t = useTranslations("Reviews");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const form = new FormData();
        form.set("file", file);
        const res = await fetch("/api/reviews/photos", { method: "POST", body: form });
        const result = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (result.ok && result.url) setPhotos((p) => [...p, result.url!].slice(0, MAX_PHOTOS));
        else toast.error(errorText(result.error));
      }
    } catch {
      toast.error(errorText("unknown"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = () =>
    startTransition(async () => {
      const result = await submitReviewAction({
        productId,
        rating,
        title,
        body,
        imageUrls: photos,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(errorText(result.error));
        return;
      }
      setOpen(false);
      toast.success(t("submitted"));
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("write")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("writeFor", { name: productName })}</DialogTitle>
            <DialogDescription>{t("moderationNote")}</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-1">
            <legend className="text-sm font-medium">{t("yourRating")}</legend>
            <div className="flex gap-1" role="radiogroup" aria-label={t("yourRating")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={t("stars", { count: n })}
                  onClick={() => setRating(n)}
                  className="rounded p-1 hover:bg-accent focus-visible:outline-2"
                >
                  <Star
                    className={cn(
                      "size-7",
                      n <= rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            {errors.rating && (
              <p className="text-sm text-destructive">{errorText(errors.rating)}</p>
            )}
          </fieldset>

          <FormField id="review-title" label={t("titleField")} error={errorText(errors.title)}>
            {(aria) => (
              <Input
                {...aria}
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </FormField>
          <FormField id="review-body" label={t("bodyField")} error={errorText(errors.body)}>
            {(aria) => (
              <Textarea
                {...aria}
                rows={4}
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            )}
          </FormField>

          {photosEnabled && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("photos")}</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((url) => (
                  <div key={url} className="relative">
                    <Image
                      src={url}
                      alt=""
                      width={64}
                      height={64}
                      className="size-16 rounded-md object-cover"
                      unoptimized={isLocalUpload(url)}
                    />
                    <button
                      type="button"
                      aria-label={t("removePhoto")}
                      onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                      className="absolute -top-2 -right-2 rounded-full bg-background p-0.5 shadow"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Button
                    type="button"
                    variant="outline"
                    className="size-16"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                    aria-label={t("addPhoto")}
                  >
                    <ImagePlus aria-hidden />
                  </Button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                hidden
                onChange={(e) => upload(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">{t("photosHint")}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isPending || uploading}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
