"use client";

import { SerwistProvider, useSerwist } from "@serwist/turbopack/react";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

/** Offers a reload when a new version of the app has been downloaded. */
function UpdateToast() {
  const t = useTranslations("Pwa");
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => {
      toast.info(t("updateAvailable"), {
        duration: Infinity,
        action: {
          label: t("reload"),
          onClick: () => {
            serwist.addEventListener("controlling", () => window.location.reload());
            serwist.messageSkipWaiting();
          },
        },
      });
    };
    serwist.addEventListener("waiting", onWaiting);
    return () => serwist.removeEventListener("waiting", onWaiting);
  }, [serwist, t]);

  return null;
}

/**
 * Registers the service worker (/serwist/sw.js). Disabled in development unless
 * NEXT_PUBLIC_ENABLE_SW=true, so cached pages never hide code changes while developing.
 */
export function PwaProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={!enabled} reloadOnOnline={false}>
      {enabled && <UpdateToast />}
      {children}
    </SerwistProvider>
  );
}
