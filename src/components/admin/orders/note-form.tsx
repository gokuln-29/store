"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { useRouter } from "@/i18n/navigation";
import { addOrderNoteAction } from "@/lib/actions/orders.actions";

/** Adds a staff-only note to the order timeline. */
export function NoteForm({ orderId }: { orderId: string }) {
  const t = useTranslations("AdminOrders");
  const errorText = useErrorText();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await addOrderNoteAction({ orderId, note });
          if (!result.ok) {
            setError(errorText(result.fieldErrors?.note ?? result.error));
            return;
          }
          setError(undefined);
          setNote("");
          toast.success(t("noteAdded"));
          router.refresh();
        });
      }}
    >
      <FormField id="order-note" label={t("noteLabel")} hint={t("noteHint")} error={error}>
        {(aria) => (
          <Textarea
            {...aria}
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </FormField>
      <div>
        <Button type="submit" variant="outline" disabled={isPending || !note.trim()}>
          {t("addNote")}
        </Button>
      </div>
    </form>
  );
}
