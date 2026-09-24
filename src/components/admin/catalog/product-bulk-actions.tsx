"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { BulkActionBar } from "@/components/admin/data-table/selection";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { setProductsStatusAction } from "@/lib/actions/catalog.actions";

export function ProductBulkActions() {
  const t = useTranslations("Products");
  const tData = useTranslations("DataTable");
  const errorText = useErrorText();
  const [isPending, startTransition] = useTransition();

  return (
    <BulkActionBar label={(count) => tData("selected", { count })}>
      {(ids, clear) => {
        const run = (status: "PUBLISHED" | "DRAFT" | "ARCHIVED") =>
          startTransition(async () => {
            const result = await setProductsStatusAction(ids, status);
            if (result.ok) {
              toast.success(t("bulkUpdated", { count: result.data.count }));
              clear();
            } else {
              toast.error(errorText(result.error));
            }
          });
        return (
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={() => run("PUBLISHED")}>
              {t("publish")}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => run("DRAFT")}>
              {t("unpublish")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run("ARCHIVED")}
            >
              {t("archive")}
            </Button>
          </div>
        );
      }}
    </BulkActionBar>
  );
}
