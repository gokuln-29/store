import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";

export async function generateMetadata() {
  const t = await getTranslations("ChangePassword");
  return { title: t("title") };
}

export default async function ChangePasswordPage({
  params,
}: PageProps<"/[locale]/admin/password">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("admin:access", locale);
  const t = await getTranslations("ChangePassword");
  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
      />
      <ChangePasswordForm />
    </>
  );
}
