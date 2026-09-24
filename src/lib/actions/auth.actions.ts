"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { signIn, signOut } from "@/lib/auth";
import { getClientIp } from "@/lib/request";
import { getOtpService } from "@/lib/services/otp.instance";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import { maskIndianMobile } from "@/lib/utils/phone";
import {
  adminLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  safeCallbackPath,
  type AdminLoginInput,
  type OtpRequestInput,
  type OtpVerifyInput,
} from "@/lib/validators/auth";
import { invalid, type ActionResult } from "./result";

function localeOrDefault(locale: string) {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/** Runs an Auth.js credentials sign-in and maps failures to error codes. */
async function credentialsSignIn(
  provider: "staff" | "otp",
  data: Record<string, string>,
): Promise<ActionResult> {
  try {
    await signIn(provider, { ...data, redirect: false });
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof CredentialsSignin) return { ok: false, error: error.code };
    if (error instanceof AuthError) return { ok: false, error: "unknown" };
    throw error;
  }
}

export async function adminLoginAction(
  input: AdminLoginInput,
  callbackUrl: string | null,
  rawLocale: string,
): Promise<ActionResult> {
  const locale = localeOrDefault(rawLocale);
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const result = await credentialsSignIn("staff", parsed.data);
  if (!result.ok) return result;
  redirect(safeCallbackPath(callbackUrl, `/${locale}/admin`));
}

export async function requestOtpAction(
  input: OtpRequestInput,
  rawLocale: string,
): Promise<ActionResult<{ phone: string; maskedPhone: string; resendAfterSeconds: number }>> {
  const locale = localeOrDefault(rawLocale);
  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { phone } = parsed.data;

  const ip = await getClientIp();
  const limit = await rateLimit(postgresRateLimitStore, RATE_LIMITS.otpSendByIp(ip));
  if (!limit.allowed) {
    return { ok: false, error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const result = await getOtpService().requestOtp({ phone, locale, ip });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === "cooldown" ? "otp_cooldown" : "rate_limited",
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }
  return {
    ok: true,
    data: {
      phone,
      maskedPhone: maskIndianMobile(phone),
      resendAfterSeconds: result.resendAfterSeconds,
    },
  };
}

export async function verifyOtpAction(
  input: OtpVerifyInput,
  callbackUrl: string | null,
  rawLocale: string,
): Promise<ActionResult> {
  const locale = localeOrDefault(rawLocale);
  const parsed = otpVerifySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const result = await credentialsSignIn("otp", { ...parsed.data, locale });
  if (!result.ok) return result;
  redirect(safeCallbackPath(callbackUrl, `/${locale}/account`));
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeOrDefault(String(formData.get("locale") ?? ""));
  const area = formData.get("area") === "admin" ? "admin" : "store";
  await signOut({ redirectTo: area === "admin" ? `/${locale}/admin/login` : `/${locale}` });
}
