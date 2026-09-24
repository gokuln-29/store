"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** A labelled on/off setting with an optional description. */
export function SwitchField({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <Label htmlFor={id}>{label}</Label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </div>
  );
}
