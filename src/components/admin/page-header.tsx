import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@/i18n/navigation";

export type Crumb = { label: string; href?: string };

export async function AdminPageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}) {
  const t = await getTranslations("AdminNav");
  const trail: Crumb[] = [{ label: t("dashboard"), href: "/admin" }, ...breadcrumbs];

  return (
    <div className="mb-6 grid gap-3">
      {breadcrumbs.length > 0 && (
        <Breadcrumb aria-label={t("breadcrumb")}>
          <BreadcrumbList>
            {trail.map((crumb, i) => {
              const last = i === trail.length - 1;
              return (
                <span key={`${crumb.label}-${i}`} className="contents">
                  <BreadcrumbItem>
                    {last || !crumb.href ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator />}
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
