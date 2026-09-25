"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  const t = useTranslations("Pwa");
  return (
    <Button onClick={() => window.location.reload()}>
      <RefreshCw aria-hidden />
      {t("tryAgain")}
    </Button>
  );
}
