import { LogOut } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth.actions";

export async function LogoutButton({
  area,
  variant = "ghost",
  className,
}: {
  area: "admin" | "store";
  variant?: "ghost" | "outline";
  className?: string;
}) {
  const t = await getTranslations("Common");
  const locale = await getLocale();

  return (
    <form action={logoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="area" value={area} />
      <Button type="submit" variant={variant} size="sm" className={className}>
        <LogOut className="size-4" aria-hidden />
        {t("logout")}
      </Button>
    </form>
  );
}
