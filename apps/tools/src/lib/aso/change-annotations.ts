export type ChangeAnnotation = { id: string; date: string; title: string; changeType: string; country: string };

export function chartChanges(changes: ChangeAnnotation[], country: string | undefined, start: string, end: string): ChangeAnnotation[] {
  return changes.filter((change) => change.date >= start && change.date <= end && (!country || change.country.toLowerCase() === "all" || change.country.toLowerCase() === country.toLowerCase()))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
