import { NextRequest, NextResponse } from "next/server";
import { fixturePreviewAllowed, parseScope } from "@/lib/signal/contracts";
import {
  buildSampleSnapshot,
  snapshotExport,
  coverageForArea,
} from "@/lib/signal/snapshot";
import { toCSV } from "@/lib/signal/analytics";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (
    !fixturePreviewAllowed(
      process.env,
      request.nextUrl.searchParams.get("data") === "sample",
    )
  )
    return NextResponse.json(
      {
        error:
          "Sample endpoint disabled. Live analytics requires authenticated source validation.",
      },
      { status: 404 },
    );
  const scope = parseScope(request.nextUrl.searchParams),
    data = buildSampleSnapshot(scope),
    area = request.nextUrl.searchParams.get("area") ?? scope.productTab,
    rows = snapshotExport(data, area);
  if (request.nextUrl.searchParams.get("format") === "csv")
    return new Response(toCSV(rows), {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="kopa-SAMPLE-${area.replace(/[^a-z]/g, "")}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  return NextResponse.json(
    {
      metadata: {
        ...data.metadata,
        source: coverageForArea(data, area).source,
        complete: coverageForArea(data, area).complete,
      },
      coverage: coverageForArea(data, area),
      rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
