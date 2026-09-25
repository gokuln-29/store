import type { StateStorage } from "zustand/middleware";

/** localStorage that never throws (private mode, blocked storage): data then lives in memory. */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Ignore: it keeps working for this visit.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  },
};
