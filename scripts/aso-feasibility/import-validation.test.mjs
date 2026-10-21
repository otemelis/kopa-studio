// Explicit synthetic CSV fixtures in temporary files; no real reporting source is overwritten.
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';import{spawnSync}from'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kopa-import-test-'));
const header='App name "InnerType: Persönlichkeitstest"\nCountry: de,Device: iphone\nKeyword,Position,2026-10-09,2026-10-10,2026-10-11,2026-10-12,2026-10-13,2026-10-14,2026-10-15\n';
const row='fixture-only,3,-,,1,2,3,-,3\n';
function run(text){const p=path.join(dir,'synthetic.csv');fs.writeFileSync(p,text);return spawnSync(process.execPath,['scripts/aso-feasibility/compare-appfollow.mjs',p],{encoding:'utf8'});}
test('blank/dash remain null; absent catalog dates remain missing',()=>{const r=run(header+row);assert.equal(r.status,0);const d=JSON.parse(r.stdout);assert.equal(d.comparisons[0].appfollow_rank,null);assert.equal(d.comparisons[1].appfollow_rank,null);assert.equal(d.comparisons.at(-1).appfollow_rank,3);assert.equal(d.controls.kopa_missing_cells,7);});
test('reject wrong market and device rather than silently relabel',()=>{assert.notEqual(run((header+row).replace('Country: de','Country: us')).status,0);assert.notEqual(run((header+row).replace('Device: iphone','Device: ipad')).status,0);});
test('reject rank zero, unknown tokens and duplicate keywords',()=>{assert.notEqual(run(header+row.replace(',1,2,',',0,2,')).status,0);assert.notEqual(run(header+row.replace(',1,2,',',unknown,2,')).status,0);assert.notEqual(run(header+row+row).status,0);});
test('reject inconsistent current position rather than changing source',()=>{assert.notEqual(run(header+row.replace('fixture-only,3','fixture-only,4')).status,0);});
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
