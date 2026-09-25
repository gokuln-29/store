"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { deleteReviewAction, moderateReviewAction } from "@/lib/actions/reviews.actions";

export function ReviewActions({
  id,
  status,
}: {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const t = useTranslations("AdminReviews");
  const errorText = useErrorText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, message: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(errorText(result.error));
      toast.success(message);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-1">
      {status !== "APPROVED" && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => run(() => moderateReviewAction(id, "APPROVED"), t("approved"))}
        >
          {t("approve")}
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => moderateReviewAction(id, "REJECTED"), t("rejected"))}
        >
          {t("reject")}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => run(() => deleteReviewAction(id), t("deleted"))}
      >
        {t("delete")}
      </Button>
    </div>
  );
}
