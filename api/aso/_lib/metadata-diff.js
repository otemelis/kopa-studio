// Detect metadata changes between two snapshots of the same listing.
// Ported from acros-studio/lib/aso/metadata-diff.ts (types stripped only).

function trunc(v, max = 300) {
  if (v == null) return null;
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

export function diffMetadata(prev, next) {
  const changes = [];

  if (prev.name !== next.name) {
    changes.push({ change_type: "title", field: "name", old_value: prev.name, new_value: next.name });
  }
  if ((prev.subtitle ?? "") !== (next.subtitle ?? "")) {
    changes.push({ change_type: "subtitle", field: "subtitle", old_value: prev.subtitle, new_value: next.subtitle });
  }
  if ((prev.description ?? "") !== (next.description ?? "")) {
    changes.push({
      change_type: "description",
      field: "description",
      old_value: trunc(prev.description),
      new_value: trunc(next.description),
    });
  }
  if ((prev.icon_url ?? "") !== (next.icon_url ?? "")) {
    changes.push({ change_type: "icon", field: "icon_url", old_value: prev.icon_url, new_value: next.icon_url });
  }
  if ((prev.price ?? null) !== (next.price ?? null)) {
    changes.push({
      change_type: "pricing",
      field: "price",
      old_value: prev.price != null ? String(prev.price) : null,
      new_value: next.price != null ? String(next.price) : null,
    });
  }
  if ((prev.current_version ?? "") !== (next.current_version ?? "")) {
    changes.push({
      change_type: "app_update",
      field: "current_version",
      old_value: prev.current_version,
      new_value: next.current_version,
    });
  }

  const prevShots = prev.screenshot_urls ?? [];
  const nextShots = next.screenshot_urls ?? [];
  if (prevShots.length > 0 || nextShots.length > 0) {
    const sameSet =
      prevShots.length === nextShots.length &&
      [...prevShots].sort().join("|") === [...nextShots].sort().join("|");
    const sameOrder = prevShots.join("|") === nextShots.join("|");
    if (!sameSet) {
      const firstChanged = prevShots[0] !== nextShots[0];
      changes.push({
        change_type: firstChanged && prevShots.length > 0 ? "first_screenshot" : "screenshots",
        field: "screenshot_urls",
        old_value: `${prevShots.length} screenshot(s)`,
        new_value: `${nextShots.length} screenshot(s)`,
      });
    } else if (!sameOrder) {
      changes.push({
        change_type: "screenshots_reordered",
        field: "screenshot_urls",
        old_value: "previous order",
        new_value: "new order",
      });
    }
  }

  return changes;
}

/** Stable checksum of the fields we snapshot, for cheap "did it change". */
export function metadataChecksum(fields) {
  const canonical = JSON.stringify([
    fields.name,
    fields.subtitle ?? "",
    fields.description ?? "",
    fields.icon_url ?? "",
    (fields.screenshot_urls ?? []).join("|"),
    fields.current_version ?? "",
    fields.release_notes ?? "",
    fields.price ?? "",
  ]);
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}
