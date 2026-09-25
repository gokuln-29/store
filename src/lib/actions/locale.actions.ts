"use server";

import { hasLocale } from "next-intl";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const endpointSchema = z.url({ protocol: /^https$/ }).max(1000);

/**
 * Remembers a language switch beyond the cookie: a signed-in customer's preferred language
 * (used for emails, SMS and push) and this device's push notifications.
 */
export async function rememberLocaleAction(
  locale: string,
  pushEndpoint: string | null,
): Promise<void> {
  if (!hasLocale(routing.locales, locale)) return;
  const user = await getCurrentUser();
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { preferredLocale: locale } });
    await db.pushSubscription.updateMany({ where: { userId: user.id }, data: { locale } });
  }
  const endpoint = endpointSchema.safeParse(pushEndpoint);
  if (endpoint.success) {
    await db.pushSubscription.updateMany({ where: { endpoint: endpoint.data }, data: { locale } });
  }
}
