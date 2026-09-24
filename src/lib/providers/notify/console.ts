import type { SmsProvider } from "./types";

/** Development provider: prints the OTP to the server console instead of sending an SMS. */
export const consoleSmsProvider: SmsProvider = {
  name: "console",
  async sendOtp({ to, code, locale, expiresInMinutes }) {
    console.info(
      `\n[sms:console] OTP for ${to} (${locale}): ${code}  — valid ${expiresInMinutes} min\n`,
    );
  },
};
