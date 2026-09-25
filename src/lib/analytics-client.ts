"use client";

/**
 * Anonymous funnel beacon. A random id per browser tab session (sessionStorage, no cookie);
 * nothing is sent when the browser asks not to be tracked (Do Not Track / Global Privacy Control).
 */
export type FunnelStepName = "visit" | "cart" | "checkout" | "ordered";

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem("fx-sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("fx-sid", id);
    }
    return id;
  } catch {
    return null;
  }
}

export function trackFunnel(step: FunnelStepName): void {
  if (typeof window === "undefined" || optedOut()) return;
  const id = sessionId();
  if (!id) return;
  const key = `fx-${step}-${new Date().toDateString()}`;
  try {
    if (sessionStorage.getItem(key)) return; // already counted today
    sessionStorage.setItem(key, "1");
  } catch {
    // counted server-side once per session and day anyway
  }
  const body = JSON.stringify({ s: id, step });
  if (!navigator.sendBeacon?.("/api/analytics", body)) {
    fetch("/api/analytics", { method: "POST", body, keepalive: true }).catch(() => undefined);
  }
}
