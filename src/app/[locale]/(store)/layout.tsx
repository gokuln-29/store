import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { StoreShell } from "@/components/shared/store-shell";

export default async function StoreLayout({ children, params }: LayoutProps<"/[locale]">) {
  // Each layout renders independently, so it must set the locale for static rendering.
  setRequestLocale((await params).locale as Locale);
  return <StoreShell>{children}</StoreShell>;
}
