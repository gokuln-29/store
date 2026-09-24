/**
 * Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts "98765 43210", "+91-98765-43210", "09876543210", "919876543210".
 * Returns null if it is not a valid Indian mobile number (must start with 6–9).
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith("+91")) return null;
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" -> "+91 98765 43210" */
export function formatIndianMobile(e164: string): string {
  const local = e164.replace(/^\+91/, "");
  return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : e164;
}

/** "+919876543210" -> "+91 ••••• •3210" for display in OTP screens and logs. */
export function maskIndianMobile(e164: string): string {
  return `+91 ••••• •${e164.slice(-4)}`;
}
