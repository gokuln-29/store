"use client";

import { Trash2 } from "lucide-react";
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
import { deleteShippingRuleAction } from "@/lib/actions/settings.actions";

export function DeleteShippingRuleButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("Shipping");
  const tCommon = useTranslations("Common");
  const tAddr = useTranslations("Addresses");
  const errorText = useErrorText();
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          aria-label={`${tAddr("delete")}: ${name}`}
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
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const result = await deleteShippingRuleAction(id);
                if (result.ok) toast.success(t("deleted"));
                else toast.error(errorText(result.error));
              })
            }
          >
            {tAddr("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
