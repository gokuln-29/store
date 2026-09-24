"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AdminTheme = "light" | "dark" | "system";
export const ADMIN_THEME_COOKIE = "admin-theme";

const ThemeContext = createContext<{ theme: AdminTheme; setTheme: (t: AdminTheme) => void } | null>(
  null,
);

export function useAdminTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAdminTheme must be used inside <AdminThemeScope>");
  return ctx;
}

function prefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Dark mode for the admin panel only. The server renders the wrapper with the saved theme
 * (cookie) so there is no flash; while mounted, `dark` is also set on <html> so dialogs and
 * menus (rendered in portals) match. Leaving the admin removes it, so the store stays light.
 */
export function AdminThemeScope({
  initial,
  children,
}: {
  initial: AdminTheme;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<AdminTheme>(initial);
  const [systemDark, setSystemDark] = useState(false);
  const dark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
    return () => {
      root.classList.remove("dark");
      root.style.colorScheme = "";
    };
  }, [dark]);

  function setTheme(next: AdminTheme) {
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    if (next === "system") setSystemDark(prefersDark());
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={cn("contents", dark && "dark")}>{children}</div>
    </ThemeContext.Provider>
  );
}
