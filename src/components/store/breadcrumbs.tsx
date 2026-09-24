import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/seo";
import { JsonLd } from "./json-ld";

export type StoreCrumb = { label: string; href?: string };

/** Visible breadcrumbs plus BreadcrumbList structured data. */
export async function StoreBreadcrumbs({ items, locale }: { items: StoreCrumb[]; locale: string }) {
  const t = await getTranslations("Header");
  const trail: StoreCrumb[] = [{ label: t("home"), href: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {last || !crumb.href ? (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={last ? "text-foreground" : undefined}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="hover:text-foreground hover:underline">
                    {crumb.label}
                  </Link>
                )}
                {!last && <ChevronRight className="size-3.5" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((crumb, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: crumb.label,
            ...(crumb.href
              ? { item: `${siteUrl()}/${locale}${crumb.href === "/" ? "" : crumb.href}` }
              : {}),
          })),
        }}
      />
    </>
  );
}
