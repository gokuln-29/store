"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
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
import { useErrorText } from "@/hooks/use-error-text";
import { Link } from "@/i18n/navigation";
import {
  deleteSectionAction,
  moveSectionAction,
  setSectionActiveAction,
} from "@/lib/actions/content.actions";
import type { ActionResult } from "@/lib/actions/result";

export function SectionRowActions({
  id,
  label,
  isActive,
  isFirst,
  isLast,
}: {
  id: string;
  label: string;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const t = useTranslations("Content");
  const tCat = useTranslations("Categories");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const [isPending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(errorText(result.error));
      else if (success) toast.success(success);
    });

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        disabled={isPending || isFirst}
        onClick={() => run(() => moveSectionAction(id, "up"))}
        aria-label={`${tCat("moveUp")}: ${label}`}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={isPending || isLast}
        onClick={() => run(() => moveSectionAction(id, "down"))}
        aria-label={`${tCat("moveDown")}: ${label}`}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={isPending}
        onClick={() => run(() => setSectionActiveAction(id, !isActive))}
        aria-label={`${isActive ? t("hide") : t("show")}: ${label}`}
      >
        {isActive ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </Button>
      <Button asChild variant="ghost" size="icon">
        <Link href={`/admin/content/${id}`} aria-label={`${t("edit")}: ${label}`}>
          <Pencil className="size-4" aria-hidden />
        </Link>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label={`${t("delete")}: ${label}`}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => deleteSectionAction(id), t("deleted"))}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
