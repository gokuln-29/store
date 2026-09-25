import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { couponCategoryOptions } from "@/lib/services/coupon.service";
import { categoryOptions, couponFormDefaults } from "@/lib/utils/coupon-view";
import { localize } from "@/lib/utils/localized";

export async function generateMetadata() {
  const t = await getTranslations("Coupons");
  return { title: t("new") };
}

export default async function NewCouponPage({ params }: PageProps<"/[locale]/admin/coupons/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("coupons:manage", locale);
  const [t, categories] = await Promise.all([getTranslations("Coupons"), couponCategoryOptions()]);
  return (
    <>
      <AdminPageHeader
        title={t("new")}
        breadcrumbs={[{ label: t("title"), href: "/admin/coupons" }, { label: t("new") }]}
      />
      <CouponForm
        id={null}
        defaults={couponFormDefaults(null)}
        categories={categoryOptions(categories, (n) => localize(n, locale))}
        selectedProducts={[]}
      />
    </>
  );
}
