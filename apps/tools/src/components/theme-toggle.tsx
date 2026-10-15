"use client";
import { useEffect } from "react";
import { resolveTheme, type ThemePreference } from "@/lib/signal/theme";
import { useStoredText } from "@/lib/signal/browser-storage";
export function ThemeToggle({ ownerId = "preview" }: { ownerId?: string }) {
  const [stored, write] = useStoredText(
    "kopa-theme:" + ownerId,
    "system",
    ownerId === "preview" ? "kopa-tools-theme" : "",
  );
  const preference: ThemePreference =
    stored === "dark" || stored === "light" ? stored : "system";
  useEffect(() => {
    try {
      localStorage.setItem("kopa-active-owner", ownerId);
    } catch {}
    const media = matchMedia("(prefers-color-scheme: dark)"),
      apply = () => {
        document.documentElement.dataset.theme = resolveTheme(
          preference,
          media.matches,
        );
        document.documentElement.style.colorScheme =
          document.documentElement.dataset.theme;
      };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [ownerId, preference]);
  function change(value: ThemePreference) {
    write(value);
    try {
      localStorage.setItem("kopa-tools-theme", value);
    } catch {}
    document.documentElement.dataset.theme = resolveTheme(
      value,
      matchMedia("(prefers-color-scheme: dark)").matches,
    );
    document.documentElement.style.colorScheme =
      document.documentElement.dataset.theme;
  }
  return (
    <label className="signal-theme">
      <span>Appearance</span>
      <select
        aria-label="Appearance"
        value={preference}
        onChange={(e) => change(e.target.value as ThemePreference)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
