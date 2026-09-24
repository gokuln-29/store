"use client";

import { Input } from "@/components/ui/input";

/** Native colour picker plus a hex text field, kept in sync. */
export function ColorInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
        aria-hidden
        tabIndex={-1}
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        maxLength={7}
        className="w-32 font-mono"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
    </div>
  );
}
