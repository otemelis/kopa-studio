import {
  localRequestAllowed,
  localSnapshotEnabled,
} from "@/lib/product-analytics/contracts";
import { readProductReport } from "@/lib/product-analytics/repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};
export async function GET(request: Request) {
  // An intentionally local development adapter. No production authentication bypass.
  if (!localSnapshotEnabled(process.env))
    return Response.json(
      {
        status: "unavailable",
        error: "The validated local source is not enabled.",
      },
      { status: 404, headers },
    );
  if (
    !localRequestAllowed(
      request.headers.get("host"),
      request.headers.get("origin"),
    )
  )
    return Response.json({ status: "unavailable" }, { status: 403, headers });
  const params = new URL(request.url).searchParams;
  if (params.get("data") === "sample")
    return Response.json(
      {
        status: "unavailable",
        error: "Use the explicit sample endpoint for synthetic fixtures.",
      },
      { status: 400, headers },
    );
  try {
    const report = await readProductReport(params);
    return Response.json(
      { status: report.metrics.events ? "incomplete" : "empty", report },
      { headers },
    );
  } catch {
    // Never serialize SQL, socket paths, configuration, identity rows or fall back to fixtures.
    return Response.json(
      {
        status: "unavailable",
        error:
          "The validated source could not be read, or the scope is invalid. No metrics have been substituted. Check the local source and selected dates.",
      },
      { status: 503, headers },
    );
  }
}
