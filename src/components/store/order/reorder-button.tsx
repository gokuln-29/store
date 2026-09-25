"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { reorderAction } from "@/lib/actions/my-orders.actions";
import { useCart } from "@/lib/cart-store";

/** Puts the order's still-available items back in the cart (at today's prices). */
export function ReorderButton({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("MyOrders");
  const errorText = useErrorText();
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await reorderAction(orderNumber);
          if (!result.ok) return void toast.error(errorText(result.error));
          const { items, unavailable } = result.data;
          if (!items.length) return void toast.error(t("reorderNone"));
          for (const item of items) add(item.variantId, item.quantity);
          toast.success(t("reordered", { count: items.length }), {
            description: unavailable ? t("reorderPartial", { count: unavailable }) : undefined,
          });
          router.push("/cart");
        })
      }
    >
      <RotateCcw aria-hidden />
      {t("reorder")}
    </Button>
  );
}
