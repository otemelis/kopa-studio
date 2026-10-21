// Bounded, offline validation for the curated project-context JSON. No provider or database calls.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

function exactKeys(value, keys){
 if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))throw Error('Unexpected change-log fields');
}
function utc(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value.slice(0,10))throw Error('Invalid UTC timestamp');
}
export function validateChangeLog(log,evidenceBytes){
 exactKeys(log,['schema_version','mode','generated_at_utc','coverage_note','evidence','entries']);
 if(log.schema_version!==1||log.mode!=='read_only_project_change_log')throw Error('Unsupported change log');
 utc(log.generated_at_utc);
 if(typeof log.coverage_note!=='string'||!log.coverage_note||log.coverage_note.length>1000)throw Error('Missing coverage limits');
 exactKeys(log.evidence,['repository_path','sha256']);
 if(!/^docs\/milestones\/m8\/[a-z0-9-]+\.json$/.test(log.evidence.repository_path)||!/^[a-f0-9]{64}$/.test(log.evidence.sha256)||crypto.createHash('sha256').update(evidenceBytes).digest('hex')!==log.evidence.sha256)throw Error('Evidence integrity mismatch');
 const source=JSON.parse(evidenceBytes);
 if(source.verified_against_retained_sources_at_utc!==log.generated_at_utc)throw Error('Verification timestamp mismatch');
 if(!Array.isArray(log.entries)||log.entries.length>100)throw Error('Invalid entry list');
 const ids=new Set(),apps=new Set(['InnerType','LoveType','POIS','PASSPORT']);
 const scopeByKind={collector_deployment:'hosted_analytics_backend',internal_build_registration:'internal_testflight',analytics_request_enabled:'apple_reporting_configuration'};
 for(const entry of log.entries){
  exactKeys(entry,['id','apps','scope','kind','occurred_at_utc','response_observed_at_utc','summary','measurement_note','evidence_key']);
  if(typeof entry.id!=='string'||!/^[a-z0-9-]+$/.test(entry.id)||ids.has(entry.id))throw Error('Duplicate or invalid entry ID');ids.add(entry.id);
  if(!Array.isArray(entry.apps)||!entry.apps.length||new Set(entry.apps).size!==entry.apps.length||entry.apps.some(app=>!apps.has(app)))throw Error('Invalid app scope');
  if(!scopeByKind[entry.kind]||scopeByKind[entry.kind]!==entry.scope)throw Error('Unsupported deployment/release scope');
  if((entry.occurred_at_utc===null)===(entry.response_observed_at_utc===null))throw Error('Specify exactly one sourced time basis');
  const time=entry.occurred_at_utc??entry.response_observed_at_utc;utc(time);
  if(Date.parse(time)>Date.parse(log.generated_at_utc))throw Error('Future change');
  for(const key of ['summary','measurement_note'])if(typeof entry[key]!=='string'||!entry[key]||entry[key].length>1000)throw Error('Missing measurement context');
  const record=source.records?.[entry.evidence_key];
  if(!record||['scope','kind','occurred_at_utc','response_observed_at_utc'].some(key=>entry[key]!==record[key])||JSON.stringify(entry.apps)!==JSON.stringify(record.apps))throw Error('Entry disagrees with retained source evidence');
 }
 return {entries:log.entries.length,evidence_sha256:log.evidence.sha256,mode:log.mode};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=new URL('../../',import.meta.url),log=JSON.parse(fs.readFileSync(new URL('reporting/portfolio/change-log.json',root)));
 // Check the fixed directory boundary before opening the declared evidence file.
 if(!/^docs\/milestones\/m8\/[a-z0-9-]+\.json$/.test(log.evidence?.repository_path??''))throw Error('Invalid evidence path');
 console.log(JSON.stringify(validateChangeLog(log,fs.readFileSync(new URL(log.evidence.repository_path,root))),null,2));
}
