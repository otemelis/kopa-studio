import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getApp } from "@/repositories/apps-repository";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({ params }: { params: Promise<{ id: string }> }) { await requireUser(); const app = await getApp((await params).id); if (!app) notFound(); return <PageShell title={app.name}><section className="metric-grid"><article className="metric-card"><p>Platform</p><strong>{app.platform}</strong><small>Existing store record</small></article><article className="metric-card"><p>Primary storefront</p><strong>{app.primaryCountry.toUpperCase()}</strong><small>Configured collection market</small></article><article className="metric-card"><p>Store rating</p><strong>{app.rating ?? "—"}</strong><small>{app.ratingCount ? `${app.ratingCount.toLocaleString()} ratings` : "No rating count recorded"}</small></article><article className="metric-card"><p>Data source</p><strong>Public store</strong><small>Read-only migration view</small></article></section><section className="notice"><h2>Migration status</h2><p>App records are now verified through the new repository layer. Keyword, ranking, competitor, localization, App Store Connect, and insight views remain in the legacy console until each is compared against this application.</p></section></PageShell>; }
