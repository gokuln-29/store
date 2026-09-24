import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/admin/catalog/product-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { listCategoriesWithAttributes } from "@/lib/services/category.service";
import { getProductForEdit } from "@/lib/services/product.service";
import {
  localizedLabel,
  productToFormInput,
  toProductFormCategories,
} from "@/lib/utils/catalog-view";

export async function generateMetadata() {
  const t = await getTranslations("Products");
  return { title: t("editTitle") };
}

export default async function EditProductPage({
  params,
}: PageProps<"/[locale]/admin/products/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("catalog:write", locale);
  const t = await getTranslations("Products");
  const [product, categories] = await Promise.all([
    getProductForEdit(id),
    listCategoriesWithAttributes(),
  ]);
  if (!product) notFound();
  const name = localizedLabel(product.name, locale);

  return (
    <>
      <AdminPageHeader
        title={name}
        breadcrumbs={[{ label: t("title"), href: "/admin/products" }, { label: name }]}
      />
      <ProductForm
        id={product.id}
        savedSlug={product.slug}
        categories={toProductFormCategories(categories)}
        defaults={productToFormInput(product)}
      />
    </>
  );
}
