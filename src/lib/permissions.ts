/**
 * Role-based permissions. Every admin page, route handler and server action must check one of
 * these on the server (the proxy check is only a first, optimistic gate).
 */
export const ROLES = ["OWNER", "STAFF", "CUSTOMER"] as const;
export type AppRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  "admin:access", // enter the admin panel
  "catalog:read",
  "catalog:write",
  "orders:read",
  "orders:manage",
  "payments:refund", // issue refunds (owner only by default)
  "customers:read",
  "coupons:manage",
  "content:manage", // home sections, banners
  "settings:manage", // store settings, payments, shipping
  "staff:manage",
  "reports:read",
  "account:self", // customer's own profile, addresses, orders
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  STAFF: new Set<Permission>([
    "admin:access",
    "catalog:read",
    "catalog:write",
    "orders:read",
    "orders:manage",
    "customers:read",
    "content:manage",
    "account:self",
  ]),
  CUSTOMER: new Set<Permission>(["account:self"]),
};

export function isRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return role === "OWNER" || role === "STAFF";
}
