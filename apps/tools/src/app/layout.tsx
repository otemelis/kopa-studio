import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Kopa Tools", robots: { index: false, follow: false } };
const themeBootstrap = `try { const saved = localStorage.getItem("kopa-tools-theme"); document.documentElement.dataset.theme = saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; }`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body>{children}</body></html>; }
