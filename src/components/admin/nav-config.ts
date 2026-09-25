import {
  Boxes,
  CreditCard,
  FolderTree,
  History,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  Package,
  Settings,
  TicketPercent,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type AdminNavKey =
  | "dashboard"
  | "products"
  | "categories"
  | "inventory"
  | "orders"
  | "payments"
  | "coupons"
  | "content"
  | "push"
  | "settings"
  | "staff"
  | "auditLog"
  | "changePassword";

export type AdminNavItem = {
  href: string;
  key: AdminNavKey;
  icon: LucideIcon;
  permission: Permission;
  /** Only highlight on an exact path match. */
  exact?: boolean;
};

export type AdminNavGroup = { items: AdminNavItem[] };

/** Sidebar structure. Items are hidden when the user lacks the permission. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    items: [
      {
        href: "/admin",
        key: "dashboard",
        icon: LayoutDashboard,
        permission: "admin:access",
        exact: true,
      },
    ],
  },
  {
    items: [
      { href: "/admin/products", key: "products", icon: Package, permission: "catalog:read" },
      {
        href: "/admin/categories",
        key: "categories",
        icon: FolderTree,
        permission: "catalog:read",
      },
      { href: "/admin/inventory", key: "inventory", icon: Boxes, permission: "catalog:read" },
    ],
  },
  {
    items: [
      { href: "/admin/orders", key: "orders", icon: ShoppingBag, permission: "orders:read" },
      { href: "/admin/payments", key: "payments", icon: CreditCard, permission: "orders:read" },
      { href: "/admin/coupons", key: "coupons", icon: TicketPercent, permission: "coupons:manage" },
    ],
  },
  {
    items: [
      {
        href: "/admin/content",
        key: "content",
        icon: LayoutTemplate,
        permission: "content:manage",
      },
      { href: "/admin/push", key: "push", icon: Megaphone, permission: "content:manage" },
    ],
  },
  {
    items: [
      { href: "/admin/settings", key: "settings", icon: Settings, permission: "settings:manage" },
      { href: "/admin/staff", key: "staff", icon: Users, permission: "staff:manage" },
      { href: "/admin/audit-log", key: "auditLog", icon: History, permission: "reports:read" },
    ],
  },
  {
    items: [
      {
        href: "/admin/password",
        key: "changePassword",
        icon: KeyRound,
        permission: "admin:access",
      },
    ],
  },
];
