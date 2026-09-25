import { consoleEmailProvider, consoleSmsProvider, consoleWhatsAppProvider } from "./console";
import { createResendProvider } from "./resend";
import type { EmailProvider, SmsProvider, WhatsAppProvider } from "./types";

export type {
  EmailMessage,
  EmailProvider,
  OtpMessage,
  SmsProvider,
  TextMessage,
  WhatsAppProvider,
} from "./types";

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Picks the SMS provider from SMS_PROVIDER (default "console").
 * Real providers (MSG91, Twilio, Gupshup, …) are added here as adapters.
 */
export function getSmsProvider(): SmsProvider {
  const name = process.env.SMS_PROVIDER ?? "console";
  switch (name) {
    case "console":
      if (isProduction() && process.env.ALLOW_CONSOLE_SMS !== "true") {
        throw new Error(
          "SMS_PROVIDER=console is not allowed in production. Configure a real SMS provider.",
        );
      }
      return consoleSmsProvider;
    default:
      throw new Error(`Unknown SMS_PROVIDER "${name}"`);
  }
}

let emailOverride: EmailProvider | null | undefined;

/** Tests only. */
export function setEmailProviderForTests(provider: EmailProvider | null | undefined): void {
  emailOverride = provider;
}

/**
 * Email provider from EMAIL_PROVIDER: "resend", "console" or "none". Defaults to Resend when
 * RESEND_API_KEY is set, otherwise the console in development and none in production.
 * Returns null when email is switched off.
 */
export function getEmailProvider(): EmailProvider | null {
  if (emailOverride !== undefined) return emailOverride;
  const key = process.env.RESEND_API_KEY;
  const name = process.env.EMAIL_PROVIDER ?? (key ? "resend" : isProduction() ? "none" : "console");
  switch (name) {
    case "resend":
      if (!key || !process.env.EMAIL_FROM) {
        throw new Error("EMAIL_PROVIDER=resend needs RESEND_API_KEY and EMAIL_FROM.");
      }
      return createResendProvider({ apiKey: key, from: process.env.EMAIL_FROM });
    case "console":
      return consoleEmailProvider;
    case "none":
      return null;
    default:
      throw new Error(`Unknown EMAIL_PROVIDER "${name}"`);
  }
}

/** WhatsApp provider from WHATSAPP_PROVIDER: "none" (default) or "console". */
export function getWhatsAppProvider(): WhatsAppProvider | null {
  const name = process.env.WHATSAPP_PROVIDER ?? "none";
  switch (name) {
    case "none":
      return null;
    case "console":
      return consoleWhatsAppProvider;
    default:
      throw new Error(`Unknown WHATSAPP_PROVIDER "${name}"`);
  }
}

/** Whether order SMS are sent: SMS_ORDER_UPDATES=false turns them off (e.g. to save costs). */
export function orderSmsEnabled(): boolean {
  return process.env.SMS_ORDER_UPDATES !== "false";
}
