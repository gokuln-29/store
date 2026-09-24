import { Images, Pencil, Plus } from "lucide-react";
import Image from "next/image";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { listBanners } from "@/lib/services/content.service";
import { localize } from "@/lib/utils/localized";

export async function generateMetadata() {
  const t = await getTranslations("Banners");
  return { title: t("title") };
}

export default async function BannersPage({
  params,
}: PageProps<"/[locale]/admin/content/banners">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("content:manage", locale);
  const [t, tContent] = await Promise.all([getTranslations("Banners"), getTranslations("Content")]);
  const banners = await listBanners();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: tContent("title"), href: "/admin/content" }, { label: t("title") }]}
        actions={
          <Button asChild size="sm">
            <Link href="/admin/content/banners/new">
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Link>
          </Button>
        }
      />
      {banners.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed bg-background px-4 py-12 text-center">
          <Images className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">{t("empty")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {banners.map((b) => {
            const title = localize(b.title, locale);
            const status = !b.isActive
              ? t("inactive")
              : b.endsAt && b.endsAt < now
                ? t("ended")
                : b.startsAt && b.startsAt > now
                  ? t("scheduled")
                  : null;
            return (
              <li key={b.id} className="overflow-hidden rounded-lg border bg-background">
                <div className="relative aspect-[8/3] bg-muted">
                  <Image
                    src={b.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                    unoptimized={b.imageUrl.startsWith("/uploads/")}
                  />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <p className="min-w-0 flex-1 truncate font-medium">{title}</p>
                  {status && <Badge variant="secondary">{status}</Badge>}
                  <Button asChild variant="ghost" size="icon">
                    <Link
                      href={`/admin/content/banners/${b.id}`}
                      aria-label={`${t("editTitle")}: ${title}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
