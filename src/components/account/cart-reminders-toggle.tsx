"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SwitchField } from "@/components/admin/forms/switch-field";
import { useErrorText } from "@/hooks/use-error-text";
import { setCartRemindersAction } from "@/lib/actions/account.actions";

export function CartRemindersToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("Account");
  const errorText = useErrorText();
  const [on, setOn] = useState(initial);
  const [isPending, startTransition] = useTransition();
  return (
    <SwitchField
      id="cart-reminders"
      label={t("cartReminders")}
      hint={t("cartRemindersHint")}
      checked={on}
      onCheckedChange={(value) => {
        if (isPending) return;
        setOn(value);
        startTransition(async () => {
          const result = await setCartRemindersAction(value);
          if (result.ok) toast.success(t("profileSaved"));
          else {
            setOn(!value);
            toast.error(errorText(result.error));
          }
        });
      }}
    />
  );
}
