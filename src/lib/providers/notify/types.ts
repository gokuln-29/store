export type OtpMessage = {
  /** E.164 phone number. */
  to: string;
  code: string;
  locale: string;
  expiresInMinutes: number;
};

/**
 * A templated text message (SMS / WhatsApp). Indian SMS needs DLT-registered templates and
 * WhatsApp needs approved templates, so providers receive the template key and its parameters;
 * `text` is the rendered message for providers (and the dev console) that send free text.
 */
export type TextMessage = {
  /** E.164 phone number. */
  to: string;
  template: string;
  params: Record<string, string>;
  locale: string;
  text: string;
};

/** SMS provider adapter. */
export interface SmsProvider {
  readonly name: string;
  sendOtp(message: OtpMessage): Promise<void>;
  sendMessage(message: TextMessage): Promise<void>;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendMessage(message: TextMessage): Promise<void>;
}

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
