import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { CartLine } from "@/lib/services/cart.service";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";

/** Image, name and option summary for a cart/checkout line. */
export function LineSummary({
  line,
  locale,
  compact = false,
}: {
  line: CartLine;
  locale: string;
  compact?: boolean;
}) {
  const name = localize(line.name, locale);
  const options = line.options.map((o) => localize(o.value, locale) || String(o.value)).join(" / ");
  const size = compact ? "size-14" : "size-20";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        href={`/p/${line.slug}`}
        className={`relative ${size} shrink-0 overflow-hidden rounded-md bg-muted`}
      >
        {line.imageUrl && (
          <Image
            src={line.imageUrl}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
            unoptimized={isLocalUpload(line.imageUrl)}
          />
        )}
      </Link>
      <div className="min-w-0">
        <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">
          {name}
        </Link>
        {options && <p className="text-xs text-muted-foreground">{options}</p>}
      </div>
    </div>
  );
}
