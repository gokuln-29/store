"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { deleteCouponAction, setCouponActiveAction } from "@/lib/actions/coupons.actions";

export function CouponRowActions({
  id,
  isActive,
  deletable,
}: {
  id: string;
  isActive: boolean;
  deletable: boolean;
}) {
  const t = useTranslations("Coupons");
  const errorText = useErrorText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(errorText(result.error));
    });

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          run(() => setCouponActiveAction(id, !isActive), isActive ? t("disabled") : t("enabled"))
        }
      >
        {isActive ? t("disable") : t("enable")}
      </Button>
      {deletable && (
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => run(() => deleteCouponAction(id), t("deleted"))}
        >
          {t("delete")}
        </Button>
      )}
    </div>
  );
}
