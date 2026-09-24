import { ExternalLink, Images, LayoutTemplate, Plus } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionRowActions } from "@/components/admin/content/section-row-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { listSections } from "@/lib/services/content.service";
import { localize } from "@/lib/utils/localized";
import { SECTION_TYPES } from "@/lib/validators/content";

export async function generateMetadata() {
  const t = await getTranslations("Content");
  return { title: t("title") };
}

export default async function ContentPage({ params }: PageProps<"/[locale]/admin/content">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("content:manage", locale, `/${locale}/admin/content`);
  const t = await getTranslations("Content");
  const sections = await listSections();

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank">
                <ExternalLink className="size-4" aria-hidden />
                {t("viewHome")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/content/banners">
                <Images className="size-4" aria-hidden />
                {t("manageBanners")}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" aria-hidden />
                  {t("addSection")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SECTION_TYPES.map((type) => (
                  <DropdownMenuItem key={type} asChild>
                    <Link href={`/admin/content/new?type=${type}`}>{t(`type${type}`)}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {sections.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed bg-background px-4 py-12 text-center">
          <LayoutTemplate className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">{t("empty")}</p>
        </div>
      ) : (
        <ol className="grid gap-2">
          {sections.map((s, i) => {
            const typeLabel = t(`type${s.type}`);
            const title = localize(s.title, locale);
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3"
              >
                <span className="w-6 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{typeLabel}</p>
                  {title && <p className="truncate text-sm text-muted-foreground">{title}</p>}
                </div>
                {!s.isActive && <Badge variant="secondary">{t("hidden")}</Badge>}
                <SectionRowActions
                  id={s.id}
                  label={title || typeLabel}
                  isActive={s.isActive}
                  isFirst={i === 0}
                  isLast={i === sections.length - 1}
                />
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
