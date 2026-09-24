"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Permission } from "@/lib/permissions";
import { AdminSidebarNav } from "./admin-sidebar";

export function AdminMobileNav({
  permissions,
  title,
}: {
  permissions: Permission[];
  title: string;
}) {
  const t = useTranslations("AdminNav");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <AdminSidebarNav permissions={permissions} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
