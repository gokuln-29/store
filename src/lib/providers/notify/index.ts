import { consoleSmsProvider } from "./console";
import type { SmsProvider } from "./types";

export type { OtpMessage, SmsProvider } from "./types";

/**
 * Picks the SMS provider from SMS_PROVIDER (default "console").
 * Real providers (MSG91, Twilio, Gupshup, …) are added here as adapters.
 */
export function getSmsProvider(): SmsProvider {
  const name = process.env.SMS_PROVIDER ?? "console";
  switch (name) {
    case "console":
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_CONSOLE_SMS !== "true") {
        throw new Error(
          "SMS_PROVIDER=console is not allowed in production. Configure a real SMS provider.",
        );
      }
      return consoleSmsProvider;
    default:
      throw new Error(`Unknown SMS_PROVIDER "${name}"`);
  }
}
