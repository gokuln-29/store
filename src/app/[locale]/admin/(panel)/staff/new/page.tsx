import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StaffForm } from "@/components/admin/staff/staff-form";
import { requirePermission } from "@/lib/auth-guards";

export async function generateMetadata() {
  const t = await getTranslations("Staff");
  return { title: t("newTitle") };
}

export default async function NewStaffPage({ params }: PageProps<"/[locale]/admin/staff/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("staff:manage", locale);
  const t = await getTranslations("Staff");
  return (
    <>
      <AdminPageHeader
        title={t("newTitle")}
        breadcrumbs={[{ label: t("title"), href: "/admin/staff" }, { label: t("newTitle") }]}
      />
      <StaffForm />
    </>
  );
}
