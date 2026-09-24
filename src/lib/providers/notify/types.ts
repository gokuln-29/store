export type OtpMessage = {
  /** E.164 phone number. */
  to: string;
  code: string;
  locale: string;
  expiresInMinutes: number;
};

/**
 * SMS/WhatsApp provider adapter. Indian SMS needs DLT-registered templates, so each provider
 * formats the message itself from structured data rather than receiving free text.
 */
export interface SmsProvider {
  readonly name: string;
  sendOtp(message: OtpMessage): Promise<void>;
}
