import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { isStaffRole, type AppRole } from "@/lib/permissions";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: AppRole;
  sessionVersion: number;
};

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  sessionVersion: true,
} as const;

// Verified against when the email does not exist, so response time does not reveal
// which emails have accounts.
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hash("not-a-real-password-used-for-timing");
  return dummyHash;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Email + password login for OWNER/STAFF. Returns null for any failure. */
export async function verifyStaffCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: { ...authUserSelect, passwordHash: true, isActive: true },
  });

  const passwordOk = await verify(user?.passwordHash ?? (await getDummyHash()), password).catch(
    () => false,
  );
  if (!user || !user.passwordHash || !passwordOk || !user.isActive || !isStaffRole(user.role)) {
    return null;
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

export type CustomerLoginResult =
  { ok: true; user: AuthUser } | { ok: false; error: "account_disabled" | "use_admin_login" };

/** Called after a successful OTP check: finds the customer by phone or registers a new one. */
export async function findOrCreateCustomerByPhone(
  phone: string,
  locale: string,
): Promise<CustomerLoginResult> {
  const now = new Date();
  const existing = await db.user.findUnique({
    where: { phone },
    select: { ...authUserSelect, isActive: true },
  });

  if (existing) {
    if (!existing.isActive) return { ok: false, error: "account_disabled" };
    // Staff accounts must use email + password, so a stolen SIM cannot open the admin panel.
    if (isStaffRole(existing.role)) return { ok: false, error: "use_admin_login" };
    await db.user.update({
      where: { id: existing.id },
      data: { lastLoginAt: now, phoneVerifiedAt: now },
    });
    return { ok: true, user: existing };
  }

  const user = await db.user.create({
    data: {
      phone,
      phoneVerifiedAt: now,
      lastLoginAt: now,
      role: "CUSTOMER",
      preferredLocale: locale,
    },
    select: authUserSelect,
  });
  return { ok: true, user };
}

/** Current state used to re-validate a session token. */
export async function getSessionUserState(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, sessionVersion: true },
  });
}

/** Invalidates every session of the user within the re-validation interval. */
export async function revokeAllSessions(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}
