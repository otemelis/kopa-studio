import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SCREEN_ROUTES, type SignalScreen } from "@/lib/signal/contracts";
const AREAS: Record<SignalScreen, string> = {
  overview: "Overview",
  keywords: "Keywords",
  ads: "Apple Ads",
  product: "Product Analytics",
  experiments: "Experiments",
  sources: "Sources",
};
const ICONS: Record<string, string> = {
  overview: "◫",
  keywords: "⌁",
  ads: "↗",
  product: "⌘",
  experiments: "⊕",
  sources: "▤",
};
/** A loopback-only review state. It exposes no production data and does not load fixtures. */
export function LocalSourceUnavailable({ screen }: { screen: SignalScreen }) {
  return (
    <div className="signal-app real-product">
      <div className="sig-review">
        <strong>LOCAL READ-ONLY REVIEW · SOURCE NOT VALIDATED</strong>
        <span>InnerType actual-data checkpoint</span>
        <ThemeToggle ownerId="local-real-data" />
      </div>
      <div className="sig-shell">
        <aside className="sig-sidebar">
          <Link className="sig-wordmark" href="/analytics?app=innertype">
            KOPA<small>STUDIO / SIGNAL</small>
          </Link>
          <nav aria-label="Main navigation">
            {Object.entries(AREAS).map(([key, label]) => (
              <Link
                key={key}
                href={
                  key === "product"
                    ? "/analytics?app=innertype"
                    : SCREEN_ROUTES[key as SignalScreen]
                }
                aria-label={label}
                aria-current={key === screen ? "page" : undefined}
              >
                <span aria-hidden>{ICONS[key]}</span>
                <b>{label}</b>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="sig-workspace">
          <header className="sig-top">Workspace / {AREAS[screen]}</header>
          <main className="sig-main">
            <div className="sig-title">
              <div>
                <span className="sig-eyebrow">SOURCE VALIDATION PENDING</span>
                <h1>{AREAS[screen]}</h1>
              </div>
            </div>
            <section className="real-state">
              <h2>
                This area has no validated data source in the local checkpoint.
              </h2>
              <p>
                InnerType Product Analytics is available from a restored,
                read-only telemetry snapshot. Other source integrations and
                authenticated production reads remain staged. No sample metrics
                have been substituted here.
              </p>
              <p>
                <Link href="/analytics?app=innertype">
                  Open actual InnerType observations →
                </Link>
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
