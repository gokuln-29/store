import { getSmsProvider } from "@/lib/providers/notify";
import { createOtpService, type OtpService } from "./otp.service";
import { postgresOtpStore } from "./otp.store";

let instance: OtpService | undefined;

/** OTP service wired to Postgres and the configured SMS provider. */
export function getOtpService(): OtpService {
  if (!instance) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is not set");
    instance = createOtpService({ store: postgresOtpStore, sms: getSmsProvider(), secret });
  }
  return instance;
}
