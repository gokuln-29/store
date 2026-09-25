import type { EmailProvider, SmsProvider, WhatsAppProvider } from "./types";

/** Development providers: print messages to the server console instead of sending them. */

export const consoleSmsProvider: SmsProvider = {
  name: "console",
  async sendOtp({ to, code, locale, expiresInMinutes }) {
    console.info(
      `\n[sms:console] OTP for ${to} (${locale}): ${code}  — valid ${expiresInMinutes} min\n`,
    );
  },
  async sendMessage({ to, template, text }) {
    console.info(`\n[sms:console] to ${to} (${template}):\n${text}\n`);
  },
};

export const consoleWhatsAppProvider: WhatsAppProvider = {
  name: "console",
  async sendMessage({ to, template, text }) {
    console.info(`\n[whatsapp:console] to ${to} (${template}):\n${text}\n`);
  },
};

export const consoleEmailProvider: EmailProvider = {
  name: "console",
  async send({ to, subject, text }) {
    console.info(`\n[email:console] to ${to}\nSubject: ${subject}\n\n${text}\n`);
  },
};
