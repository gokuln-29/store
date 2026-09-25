import { getTranslations } from "next-intl/server";
import type { OrderStatus } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  note: string | null;
  isInternal: boolean;
  createdAt: Date;
  actor: { name: string | null; email: string | null } | null;
};

/** Staff view of everything that happened to an order, newest first. */
export async function OrderTimeline({
  events,
  locale,
}: {
  events: TimelineEvent[];
  locale: string;
}) {
  const [t, tOrder] = await Promise.all([
    getTranslations("OrderTimeline"),
    getTranslations("Order"),
  ]);
  // System notes are translation keys (optionally "key · key"); staff notes are free text.
  const noteText = (note: string) =>
    note
      .split(" · ")
      .map((part) => {
        const key = `notes.${part}` as "notes.payment_captured";
        return t.has(key) ? t(key) : part;
      })
      .join(" · ");

  if (!events.length) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ol className="grid gap-4">
      {events.map((e) => (
        <li key={e.id} className="grid grid-cols-[auto_1fr] gap-3">
          <span
            aria-hidden
            className={cn(
              "mt-1.5 size-2.5 rounded-full",
              e.isInternal ? "bg-amber-500" : e.toStatus ? "bg-primary" : "bg-muted-foreground/50",
            )}
          />
          <div className="min-w-0 text-sm">
            {e.toStatus && (
              <p className="font-medium">
                {e.fromStatus
                  ? t("moved", {
                      from: tOrder(`status${e.fromStatus}`),
                      to: tOrder(`status${e.toStatus}`),
                    })
                  : tOrder(`status${e.toStatus}`)}
              </p>
            )}
            {e.note && (
              <p
                className={cn(
                  "break-words whitespace-pre-wrap",
                  e.isInternal
                    ? "rounded-md bg-amber-500/10 p-2 text-amber-900 dark:text-amber-200"
                    : e.toStatus && "text-muted-foreground",
                )}
              >
                {e.isInternal && <span className="sr-only">{t("internal")}: </span>}
                {e.isInternal ? e.note : noteText(e.note)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDateTime(e.createdAt, locale)} ·{" "}
              {e.actor?.name ?? e.actor?.email ?? t("system")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
