"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

const workspaces = [
  { label: "Dashboard", href: "/" },
  { label: "Apps", href: "/apps" },
  {
    label: "ASO Intelligence",
    href: "/aso",
    paths: ["/aso", "/keywords", "/rankings", "/competitors", "/localizations"],
    children: [
      ["Overview", "/aso"],
      ["Keywords", "/keywords"],
      ["Competitors", "/competitors"],
      ["Markets", "/localizations"],
    ],
  },
  {
    label: "Apple Ads",
    href: "/apple-ads-lab",
    paths: ["/apple-ads-lab"],
    children: [
      ["Overview", "/apple-ads-lab"],
      ["Campaigns", "/apple-ads-lab/structure"],
      ["Keywords & Search Terms", "/apple-ads-lab/keyword-intelligence"],
      ["Planner", "/apple-ads-lab/research-planner"],
      ["Attribution", "/apple-ads-lab/attribution"],
    ],
  },
  {
    label: "Actions",
    href: "/insights",
    paths: ["/insights", "/experiments", "/apple-ads-lab/recommendations"],
    children: [
      ["Recommendations", "/insights"],
      ["Change Log", "/experiments"],
    ],
  },
  {
    label: "Data & Integrations",
    href: "/app-store-connect",
    paths: ["/app-store-connect", "/collection", "/apple-ads-lab/data-quality", "/apple-ads-lab/reporting"],
    children: [
      ["Sources", "/app-store-connect"],
      ["Jobs", "/collection"],
      ["Health", "/apple-ads-lab/data-quality"],
    ],
  },
] as const;

function withContext(href: string, params: { get(name: string): string | null }) {
  const next = new URLSearchParams();
  for (const key of ["app", "country", "period"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `${href}?${query}` : href;
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);
  return <aside className="sidebar"><Link className="wordmark" href={withContext("/", searchParams)}>KOPA <span>TOOLS</span></Link><nav aria-label="Tool navigation">{workspaces.map((item) => {
    const isActive = pathname === item.href || ("paths" in item && item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)));
    const isExpanded = expanded === item.label || isActive;
    if ("children" in item) return <div className="nav-group" key={item.label}><button className={isActive ? "active" : undefined} type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded && !isActive ? null : item.label)}>{item.label}</button>{isExpanded ? <div className="nav-children">{item.children.map(([label, href]) => <Link className={pathname === href ? "active-child" : undefined} key={href} href={withContext(href, searchParams)}>{label}</Link>)}</div> : null}</div>;
    return <div className="nav-group" key={item.label}><Link className={isActive ? "active" : undefined} href={withContext(item.href, searchParams)}>{item.label}</Link></div>;
  })}</nav><form action="/auth/signout" method="post"><button className="signout" type="submit">Sign out</button></form></aside>;
}
