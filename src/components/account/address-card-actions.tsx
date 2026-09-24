"use client";

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
import { deleteAddressAction, setDefaultAddressAction } from "@/lib/actions/account.actions";

export function AddressCardActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  const t = useTranslations("Addresses");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const [isPending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof deleteAddressAction>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(successMessage);
      else toast.error(errorText(result.error));
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/account/addresses/${id}/edit`}>{t("edit")}</Link>
      </Button>
      {!isDefault && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => setDefaultAddressAction(id), t("defaultUpdated"))}
        >
          {t("setDefault")}
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={isPending}>
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => deleteAddressAction(id), t("deleted"))}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
