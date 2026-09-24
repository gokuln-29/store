"use client";

import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { cn } from "@/lib/utils";

export type UploadedImage = {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

/** Uploads a file to /api/admin/uploads and returns the stored file. */
export async function uploadAdminImage(
  file: File,
  folder: string,
): Promise<{ ok: true; file: UploadedImage } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("file", file);
  form.set("folder", folder);
  try {
    const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
    return (await res.json()) as { ok: true; file: UploadedImage } | { ok: false; error: string };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

/** Single image picker with preview (logo, favicon, category image). */
export function ImageUploadField({
  id,
  value,
  onChange,
  folder,
  accept = ACCEPT,
  previewClassName,
  describedBy,
}: {
  id: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: "branding" | "products" | "categories" | "banners";
  accept?: string;
  previewClassName?: string;
  describedBy?: string;
}) {
  const t = useTranslations("Upload");
  const errorText = useErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const result = await uploadAdminImage(file, folder);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (result.ok) onChange(result.file.url);
    else toast.error(errorText(result.error));
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
          previewClassName,
        )}
      >
        {value ? (
          <Image src={value} alt="" fill sizes="160px" className="object-contain" unoptimized />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-label={t("none")} />
        )}
      </div>
      <div className="grid gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          aria-describedby={describedBy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {uploading ? t("uploading") : value ? t("replace") : t("upload")}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="size-4" aria-hidden />
              {t("remove")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
    </div>
  );
}
