import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/admin/catalog/product-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { listCategoriesWithAttributes } from "@/lib/services/category.service";
import { toProductFormCategories } from "@/lib/utils/catalog-view";

export async function generateMetadata() {
  const t = await getTranslations("Products");
  return { title: t("newTitle") };
}

export default async function NewProductPage({
  params,
}: PageProps<"/[locale]/admin/products/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("catalog:write", locale);
  const t = await getTranslations("Products");
  const categories = toProductFormCategories(await listCategoriesWithAttributes());
  if (categories.length === 0) redirect(`/${locale}/admin/categories/new`);

  return (
    <>
      <AdminPageHeader
        title={t("newTitle")}
        breadcrumbs={[{ label: t("title"), href: "/admin/products" }, { label: t("newTitle") }]}
      />
      <ProductForm
        id={null}
        savedSlug={null}
        categories={categories}
        defaults={{
          name: {},
          shortDescription: {},
          description: {},
          slug: "",
          categoryId: "",
          status: "DRAFT",
          brand: "",
          isFeatured: false,
          attributes: {},
          options: [],
          variants: [
            {
              id: "",
              optionValues: {},
              sku: "",
              price: "",
              compareAtPrice: "",
              costPrice: "",
              stock: "0",
              lowStockThreshold: "5",
              weightGrams: "",
              isActive: true,
            },
          ],
          images: [],
          taxRateBps: "",
          hsnCode: "",
          metaTitle: {},
          metaDescription: {},
        }}
      />
    </>
  );
}
