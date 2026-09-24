import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  redirect(`/${locale}/admin/settings/general`);
}
