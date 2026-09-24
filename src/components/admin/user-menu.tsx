"use client";

import { ExternalLink, KeyRound, LogOut, UserCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/lib/actions/auth.actions";

export function AdminUserMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const t = useTranslations("AdminNav");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("userMenu")}>
          <UserCircle className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid">
          <span className="truncate">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/password">
            <KeyRound className="size-4" aria-hidden /> {t("changePassword")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank">
            <ExternalLink className="size-4" aria-hidden /> {t("viewStore")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="area" value="admin" />
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut className="size-4" aria-hidden /> {tCommon("logout")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
