"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
const subscribe = (listener: () => void) => {
  window.addEventListener("storage", listener);
  window.addEventListener("kopa-local-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("kopa-local-change", listener);
  };
};
export function useStoredText(key: string, fallback = "", legacyKey = "") {
  const read = useCallback(() => {
    try {
      return (
        localStorage.getItem(key) ??
        (legacyKey ? localStorage.getItem(legacyKey) : null) ??
        fallback
      );
    } catch {
      return fallback;
    }
  }, [key, fallback, legacyKey]);
  const server = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, read, server);
  const write = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
        window.dispatchEvent(new Event("kopa-local-change"));
        return true;
      } catch {
        return false;
      }
    },
    [key],
  );
  return [value, write] as const;
}
export function useStoredJSON<T>(key: string, fallback: T) {
  const [raw, write] = useStoredText(key, "");
  const value = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);
  return [value, (next: T) => write(JSON.stringify(next))] as const;
}
