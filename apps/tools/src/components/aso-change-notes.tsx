import Link from "next/link";
import type { ChangeAnnotation } from "@/lib/aso/change-annotations";

export function AsoChangeNotes({ changes, appId }: { changes: ChangeAnnotation[]; appId: string }) {
  if (!changes.length) return null;
  return <div className="aso-change-notes" aria-label="Change Log entries in chart window">
    {changes.map((change) => <span key={change.id}><strong>{change.date}</strong> · {change.title} <small>({change.changeType.replaceAll("_", " ")})</small></span>)}
    <small>Recorded event, not proof of an effect.</small>
    <Link href={`/experiments?app=${encodeURIComponent(appId)}`}>Change Log →</Link>
  </div>;
}
