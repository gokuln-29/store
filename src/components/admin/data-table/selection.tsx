"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";

type SelectionContextValue = {
  selected: Set<string>;
  toggle: (id: string, on: boolean) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const value = useMemo<SelectionContextValue>(
    () => ({
      selected,
      toggle: (id, on) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        }),
      setMany: (ids, on) =>
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (on) next.add(id);
            else next.delete(id);
          }
          return next;
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside <SelectionProvider>");
  return ctx;
}

export function SelectRowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <Checkbox
      checked={selected.has(id)}
      onCheckedChange={(c) => toggle(id, c === true)}
      aria-label={label}
    />
  );
}

export function SelectAllCheckbox({ ids, label }: { ids: string[]; label: string }) {
  const { selected, setMany } = useSelection();
  const count = ids.filter((id) => selected.has(id)).length;
  const state = count === 0 ? false : count === ids.length ? true : "indeterminate";
  return (
    <Checkbox
      checked={state}
      onCheckedChange={(c) => setMany(ids, c === true)}
      aria-label={label}
    />
  );
}

/** Sticky bar shown when rows are selected; render bulk action buttons as children. */
export function BulkActionBar({
  label,
  children,
}: {
  label: (count: number) => string;
  children: (ids: string[], clear: () => void) => ReactNode;
}) {
  const { selected, clear } = useSelection();
  if (selected.size === 0) return null;
  return (
    <div
      role="region"
      aria-label={label(selected.size)}
      className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-3 rounded-lg border bg-background px-4 py-2 shadow-lg"
    >
      <span className="text-sm font-medium">{label(selected.size)}</span>
      {children([...selected], clear)}
    </div>
  );
}
