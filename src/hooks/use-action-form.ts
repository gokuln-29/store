"use client";

import { useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";
import { useErrorText } from "./use-error-text";

/**
 * Submits a react-hook-form through a server action: shows field errors from the server,
 * a toast on success/failure, and exposes a pending flag. The action receives the raw form
 * input (not the client-parsed output) because the server validates it again.
 */
export function useActionForm<TInput extends FieldValues, TOutput, TData>(
  form: UseFormReturn<TInput, unknown, TOutput>,
  action: (input: TInput) => Promise<ActionResult<TData>>,
  options: { successMessage?: string; onSuccess?: (data: TData, values: TOutput) => void } = {},
) {
  const errorText = useErrorText();
  const [isPending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit(
    (values) => {
      startTransition(async () => {
        const result = await action(form.getValues());
        if (result.ok) {
          if (options.successMessage) toast.success(options.successMessage);
          options.onSuccess?.(result.data, values);
          return;
        }
        const fieldErrors = Object.entries(result.fieldErrors ?? {});
        for (const [field, message] of fieldErrors) {
          form.setError(field as Path<TInput>, { message });
        }
        toast.error(
          errorText(fieldErrors.length ? "validation" : result.error, {
            seconds: result.retryAfterSeconds ?? 0,
          }),
        );
      });
    },
    (errors) => {
      if (process.env.NODE_ENV !== "production") {
        // Helps spot errors on fields that have no visible message.
        console.warn(
          "[form] invalid fields:",
          JSON.stringify(errors, (key, value) => (key === "ref" ? undefined : value)),
        );
      }
      toast.error(errorText("validation"));
    },
  );

  return { onSubmit, isPending };
}
