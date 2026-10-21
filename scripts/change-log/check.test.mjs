import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateChangeLog} from './check.mjs';
const log=JSON.parse(fs.readFileSync(new URL('../../reporting/portfolio/change-log.json',import.meta.url)));
const evidence=fs.readFileSync(new URL('../../docs/milestones/m8/change-log-source-evidence.json',import.meta.url));

test('curated verified changes bind timestamps, scopes and apps to retained evidence',()=>{
 assert.equal(validateChangeLog(log,evidence).entries,5);
 assert.equal(log.entries.filter(x=>x.occurred_at_utc===null).length,3);
 assert(log.entries.some(x=>x.scope==='internal_testflight'));
 assert(log.entries.every(x=>x.scope!=='app_store_production'));
});
test('duplicates, unknown apps and internal-build relabeling fail closed',()=>{
 for(const change of [x=>x.entries.push(x.entries[0]),x=>x.entries[0].apps=['Unknown'],x=>x.entries.find(e=>e.scope==='internal_testflight').scope='app_store_production']){
  const value=structuredClone(log);change(value);assert.throws(()=>validateChangeLog(value,evidence));
 }
});
test('invented exact creation time, invalid dates and changed evidence are rejected',()=>{
 for(const change of [x=>{x.entries[0].occurred_at_utc=x.entries[0].response_observed_at_utc;x.entries[0].response_observed_at_utc=null;},x=>x.entries[0].response_observed_at_utc='2026-02-30T00:00:00Z',x=>x.entries[0].response_observed_at_utc='2099-01-01T00:00:00Z']){
  const value=structuredClone(log);change(value);assert.throws(()=>validateChangeLog(value,evidence));
 }
 assert.throws(()=>validateChangeLog(log,Buffer.concat([evidence,Buffer.from(' ')])),/integrity/);
});
test('credentials, causal claims and private filesystem references cannot be added as fields',()=>{
 for(const key of ['token','installation_id','causal_effect','revenue_delta']){
  const value=structuredClone(log);value.entries[0][key]='not allowed';assert.throws(()=>validateChangeLog(value,evidence));
 }
 const value=structuredClone(log);value.evidence.repository_path='../../private/reader.json';assert.throws(()=>validateChangeLog(value,evidence));
 assert.doesNotMatch(JSON.stringify(log),/BEGIN PRIVATE KEY|Bearer |eyJ[A-Za-z0-9_-]{20}|\/Users\//);
});
