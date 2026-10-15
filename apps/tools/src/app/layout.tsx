import type { Metadata } from "next";
import "./globals.css";
import "./signal.css";
import { themeBootstrap } from "@/lib/signal/theme";

export const metadata: Metadata = {
  title: "Kopa Tools",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
