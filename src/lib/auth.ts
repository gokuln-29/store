import NextAuth, { CredentialsSignin, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isRole, isStaffRole } from "@/lib/permissions";
import { clientIpFromHeaders } from "@/lib/request";
import {
  findOrCreateCustomerByPhone,
  getSessionUserState,
  verifyStaffCredentials,
} from "@/lib/services/auth.service";
import { getOtpService } from "@/lib/services/otp.instance";
import { RATE_LIMITS, rateLimit } from "@/lib/services/rate-limit.service";
import { postgresRateLimitStore } from "@/lib/services/rate-limit.store";
import { adminLoginSchema, otpVerifySchema } from "@/lib/validators/auth";

// Error codes surface to the login forms (translated there). Keep them generic.
export const AUTH_ERROR_CODES = [
  "invalid_credentials",
  "rate_limited",
  "otp_invalid",
  "otp_expired",
  "otp_too_many_attempts",
  "account_disabled",
  "use_admin_login",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

class LoginError extends CredentialsSignin {
  constructor(code: AuthErrorCode) {
    super();
    this.code = code;
  }
}

const HOUR = 60 * 60 * 1000;
const STAFF_SESSION_MS = 12 * HOUR;
const CUSTOMER_SESSION_SECONDS = 30 * 24 * 60 * 60;
/** How often a session is re-checked against the database (deactivation, role change, logout-all). */
const REVALIDATE_MS = 5 * 60 * 1000;

/** Custom claims we store in the session token (the JWT type itself is untyped for these). */
type TokenClaims = {
  role?: User["role"];
  /** User.sessionVersion at login; a mismatch ends the session. */
  sv?: number;
  /** Login time (ms). Staff sessions end 12 hours after login. */
  loginAt?: number;
  /** Last time the user was re-checked against the database (ms). */
  checkedAt?: number;
};

function readClaims(token: Record<string, unknown>): TokenClaims {
  const num = (value: unknown) => (typeof value === "number" ? value : undefined);
  return {
    role: isRole(token.role) ? token.role : undefined,
    sv: num(token.sv),
    loginAt: num(token.loginAt),
    checkedAt: num(token.checkedAt),
  };
}

function toUser(user: {
  id: string;
  name: string | null;
  email: string | null;
  role: User["role"];
  sessionVersion: number;
}): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: CUSTOMER_SESSION_SECONDS },
  pages: { signIn: "/en/login", error: "/en/login" },
  providers: [
    Credentials({
      id: "staff",
      name: "Staff",
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        // Checks live here (not only in the server action) because /api/auth/callback/staff
        // can be called directly.
        const parsed = adminLoginSchema.safeParse(raw);
        if (!parsed.success) throw new LoginError("invalid_credentials");
        const { email, password } = parsed.data;

        const ip = clientIpFromHeaders(request.headers);
        const [byIp, byEmail] = await Promise.all([
          rateLimit(postgresRateLimitStore, RATE_LIMITS.adminLoginByIp(ip)),
          rateLimit(postgresRateLimitStore, RATE_LIMITS.adminLoginByEmail(email)),
        ]);
        if (!byIp.allowed || !byEmail.allowed) throw new LoginError("rate_limited");

        const user = await verifyStaffCredentials(email, password);
        if (!user) throw new LoginError("invalid_credentials");
        return toUser(user);
      },
    }),
    Credentials({
      id: "otp",
      name: "Phone OTP",
      credentials: { phone: {}, code: {}, locale: {} },
      async authorize(raw, request) {
        const parsed = otpVerifySchema.safeParse(raw);
        if (!parsed.success) throw new LoginError("otp_invalid");
        const { phone, code } = parsed.data;
        const locale = typeof raw.locale === "string" ? raw.locale : "en";

        const ip = clientIpFromHeaders(request.headers);
        const limit = await rateLimit(postgresRateLimitStore, RATE_LIMITS.otpVerifyByIp(ip));
        if (!limit.allowed) throw new LoginError("rate_limited");

        const result = await getOtpService().verifyOtp({ phone, code });
        if (!result.ok) {
          throw new LoginError(
            result.error === "invalid_code"
              ? "otp_invalid"
              : result.error === "expired"
                ? "otp_expired"
                : "otp_too_many_attempts",
          );
        }

        const login = await findOrCreateCustomerByPhone(phone, locale);
        if (!login.ok) throw new LoginError(login.error);
        return toUser(login.user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const now = Date.now();

      if (user) {
        // Fresh sign-in.
        const claims: TokenClaims = {
          role: user.role,
          sv: user.sessionVersion,
          loginAt: now,
          checkedAt: now,
        };
        return { ...token, sub: user.id, ...claims };
      }

      const claims = readClaims(token);
      if (!token.sub || !claims.role) return null;
      if (isStaffRole(claims.role) && now - (claims.loginAt ?? 0) > STAFF_SESSION_MS) return null;

      if (now - (claims.checkedAt ?? 0) > REVALIDATE_MS) {
        const state = await getSessionUserState(token.sub);
        if (!state || !state.isActive || state.sessionVersion !== claims.sv) return null;
        return { ...token, role: state.role, checkedAt: now };
      }
      return token;
    },
    session({ session, token }) {
      const { role } = readClaims(token);
      if (token.sub && role) {
        session.user.id = token.sub;
        session.user.role = role;
      }
      return session;
    },
  },
});
