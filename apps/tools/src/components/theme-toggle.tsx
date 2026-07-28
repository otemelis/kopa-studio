"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("kopa-tools-theme", next ? "dark" : "light");
    setDark(next);
  }

  return <button className="theme-toggle" type="button" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}>{dark ? "Light theme" : "Dark theme"}</button>;
}
