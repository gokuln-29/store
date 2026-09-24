import type { Metadata } from "next";
import { hasLocale, type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileForm } from "@/components/account/profile-form";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/auth-guards";
import { getProfile } from "@/lib/services/user.service";
import { formatIndianMobile } from "@/lib/utils/phone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("profile"), robots: { index: false } };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/account`);
  const t = await getTranslations("Account");
  const profile = await getProfile(user.id);
  const preferred =
    profile?.preferredLocale && hasLocale(routing.locales, profile.preferredLocale)
      ? profile.preferredLocale
      : (locale as Locale);

  return (
    <section aria-labelledby="profile-heading" className="grid gap-4">
      <div>
        <h2 id="profile-heading" className="text-lg font-semibold">
          {t("profile")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("profileSubtitle")}</p>
      </div>
      <ProfileForm
        phone={profile?.phone ? formatIndianMobile(profile.phone) : null}
        defaults={{
          name: profile?.name ?? "",
          email: profile?.email ?? "",
          preferredLocale: preferred,
        }}
      />
    </section>
  );
}
