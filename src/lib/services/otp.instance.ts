import { DEMO_OTP_CODE, isDemoMode } from "@/lib/demo";
import { consoleSmsProvider } from "@/lib/providers/notify/console";
import { getSmsProvider } from "@/lib/providers/notify";
import { createOtpService, type OtpService } from "./otp.service";
import { postgresOtpStore } from "./otp.store";

let instance: OtpService | undefined;

/** OTP service wired to Postgres and the configured SMS provider. */
export function getOtpService(): OtpService {
  if (!instance) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is not set");
    instance = isDemoMode()
      ? // Demo: everyone signs in with the published code; nothing is sent.
        createOtpService({
          store: postgresOtpStore,
          sms: consoleSmsProvider,
          secret,
          generateCode: () => DEMO_OTP_CODE,
        })
      : createOtpService({ store: postgresOtpStore, sms: getSmsProvider(), secret });
  }
  return instance;
}
