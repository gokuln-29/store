import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <section className="container mx-auto flex flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("description")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </section>
  );
}
