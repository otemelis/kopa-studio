import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("collector imports every metadata reconciliation identity it invokes", async () => {
  const source = await readFile(new URL("../collect.js", import.meta.url), "utf8");
  const importBlock = source.match(/import \{([\s\S]*?)\} from "\.\/_lib\/insights\.js";/)?.[1] ?? "";
  for (const helper of ["metadataEvidenceScopeKey", "metadataMismatchDedupeKey"]) {
    assert.match(importBlock, new RegExp(`\\b${helper}\\b`));
    assert.match(source.slice(source.indexOf('from "./_lib/insights.js";') + 28), new RegExp(`\\b${helper}\\(`));
  }
});
