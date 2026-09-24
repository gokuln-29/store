"use client";

import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { uploadAdminImage } from "@/components/admin/forms/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import type { ProductFormInput } from "@/lib/validators/catalog-forms";

export function ProductImages() {
  const t = useTranslations("Images");
  const tUpload = useTranslations("Upload");
  const tCat = useTranslations("Categories");
  const errorText = useErrorText();
  const { control, register } = useFormContext<ProductFormInput>();
  const { fields, append, remove, move } = useFieldArray({ control, name: "images" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading(list.length);
    for (const file of list) {
      const result = await uploadAdminImage(file, "products");
      if (result.ok) {
        append({
          url: result.file.url,
          publicId: result.file.publicId,
          alt: {},
          width: result.file.width,
          height: result.file.height,
        });
      } else {
        toast.error(`${file.name}: ${errorText(result.error)}`);
      }
      setUploading((n) => n - 1);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid gap-3">
      {fields.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="grid gap-3">
        {fields.map((field, index) => (
          <li key={field.id} className="flex gap-3 rounded-md border p-2">
            <div className="relative size-20 shrink-0 overflow-hidden rounded bg-muted">
              <Image
                src={field.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
                unoptimized={field.url.startsWith("/uploads/")}
              />
            </div>
            <div className="grid min-w-0 flex-1 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{t("image", { index: index + 1 })}</span>
                {index === 0 && <Badge>{t("cover")}</Badge>}
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                {(["en", "ta", "kn"] as const).map((locale) => (
                  <Input
                    key={locale}
                    lang={locale}
                    placeholder={`${t("alt")} · ${locale.toUpperCase()}`}
                    aria-label={`${t("alt")} (${locale})`}
                    className="h-8 text-xs"
                    {...register(`images.${index}.alt.${locale}`)}
                  />
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 0)}
                  aria-label={t("makeCover")}
                  title={t("makeCover")}
                >
                  <Star className="size-4" aria-hidden />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={tCat("moveUp")}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === fields.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={tCat("moveDown")}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label={tUpload("remove")}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="sr-only"
        aria-label={t("add")}
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={uploading > 0 || fields.length >= 20}
          onClick={() => inputRef.current?.click()}
        >
          {uploading > 0 ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {uploading > 0 ? t("uploadingCount", { count: uploading }) : t("add")}
        </Button>
        <span className="text-xs text-muted-foreground">{tUpload("hint")}</span>
      </div>
    </div>
  );
}
