import Link from "next/link";

const items = [
  ["Overview", "/"], ["Apps", "/apps"], ["Keywords", "/keywords"], ["Rankings", "/rankings"], ["Competitors", "/competitors"], ["Localizations", "/localizations"], ["App Store Connect", "/app-store-connect"], ["Insights", "/insights"], ["Experiments", "/experiments"], ["Data collection", "/collection"],
] as const;

export function Sidebar() {
  return <aside className="sidebar"><Link className="wordmark" href="/">KOPA <span>TOOLS</span></Link><nav aria-label="Tool navigation">{items.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><form action="/auth/signout" method="post"><button className="signout" type="submit">Sign out</button></form></aside>;
}
