import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifySource,parseCSV,loadSnapshot,aggregate,period,difference,integer,METRICS,APPS} from '../../reporting/portfolio/model.mjs';
const bytes=fs.readFileSync(new URL('../../reporting/portfolio/daily-acquisition-monetization.csv',import.meta.url));
const text=bytes.toString('utf8'),s=loadSnapshot(text);
test('exact accepted source accepted; changed or empty bytes fail integrity',async()=>{await verifySource(bytes);await assert.rejects(verifySource(Buffer.from(text+' ')));await assert.rejects(verifySource(new Uint8Array()));});
test('CSV handles BOM, escaped quotes, embedded commas and newlines',()=>{assert.deepEqual(parseCSV('\uFEFFa,b\r\n"a,""b""","line\nnext"\r\n'),[{a:'a,"b"',b:'line\nnext'}]);assert.throws(()=>parseCSV('a,b\n"unfinished,1'));});
test('28-day exact totals retain original currencies and supported zero',()=>{
 assert.deepEqual(aggregate(s,'InnerType','first_time_app_units_sales',s.start,s.end).amounts,[{currency:'',value:54}]);
 assert.deepEqual(aggregate(s,'InnerType','estimated_proceeds_native_currency',s.start,s.end).amounts,[{currency:'GBP',value:289},{currency:'USD',value:1680}]);
 assert.deepEqual(aggregate(s,'LoveType','estimated_proceeds_native_currency',s.start,s.end).amounts,[{currency:'',value:0}]);
 assert.equal(aggregate(s,'LoveType','icon_impressions',s.start,s.end).state,'unavailable');
});
test('7-day comparable period and absolute deltas preserve zero baselines',()=>{
 const w=period(s,7);assert.equal(w.start,'2026-10-05');assert.equal(w.previous.start,'2026-09-28');assert.equal(w.comparable,true);
 const a=aggregate(s,'InnerType',METRICS[0].key,w.start,w.end),b=aggregate(s,'InnerType',METRICS[0].key,w.previous.start,w.previous.end);
 assert.equal(a.amounts[0].value,9);assert.equal(b.amounts[0].value,12);assert.equal(difference(a,b)[0].value,-3);
 const love=aggregate(s,'LoveType',METRICS[0].key,w.start,w.end);assert.equal(love.amounts[0].value,0);
});
test('28-day prior outside source is unavailable, never zero or repeated data',()=>{const w=period(s,28);assert.equal(w.comparable,false);assert.equal(aggregate(s,'InnerType',METRICS[0].key,w.previous.start,w.previous.end).state,'outside');assert.equal(w.weeks.length,4);});
test('all displayed weekly count and currency series add exactly to 28-day totals',()=>{
 const w=period(s,28);for(const app of APPS)for(const metric of METRICS){
  const total=aggregate(s,app,metric.key,w.start,w.end);const weeks=w.weeks.map(x=>aggregate(s,app,metric.key,x.start,x.end));
  if(total.state==='unavailable'){assert(weeks.every(x=>x.state==='unavailable'));continue;}
  for(const amount of total.amounts)assert.equal(weeks.reduce((n,x)=>n+x.amounts.find(a=>a.currency===amount.currency).value,0),amount.value);
 }
});
test('partial source, invalid status and unavailable numeric values are rejected',()=>{
 assert.throws(()=>loadSnapshot(text.slice(0,text.lastIndexOf('\n',text.length-2))));
 assert.throws(()=>loadSnapshot(text.replace('reported_value','unknown_status')));
 const rows=parseCSV(text);const r=rows.find(r=>r.data_quality_status==='unavailable_no_analytics_request');assert(r);assert.equal(r.value,'');
 const partial={...s,rows:s.rows.filter(r=>!(r.app==='InnerType'&&r.metric===METRICS[0].key&&r.date===s.start))};assert.equal(aggregate(partial,'InnerType',METRICS[0].key,s.start,s.end).state,'unavailable');
});
test('money precision is exact and fractional event counts are rejected',()=>{assert.equal(integer('2.89',true),289);assert.equal(integer('-0.29',true),-29);assert.throws(()=>integer('2.891',true));assert.throws(()=>integer('1.2'));});

test('four-app snapshots retain source absence separately from Sales zero and reject partial new app coverage',()=>{
 // Explicit synthetic test fixture only; never published by the report refresh.
 const rows=parseCSV(text),header=Object.keys(rows[0]);
 const additions=['POIS','PASSPORT'].flatMap(app=>rows.filter(r=>r.app==='LoveType').map(r=>({...r,app})));
 const encode=rs=>[header.join(','),...rs.map(r=>header.map(k=>'"'+String(r[k]).replaceAll('"','""')+'"').join(','))].join('\n');
 const four=loadSnapshot(encode([...rows,...additions]));
 assert.deepEqual(four.apps,['InnerType','LoveType','POIS','PASSPORT']);
 assert.equal(aggregate(four,'PASSPORT','icon_impressions',four.start,four.end).state,'unavailable');
 assert.equal(aggregate(four,'PASSPORT','apple_reported_paid_iap_units_sales',four.start,four.end).amounts[0].value,0);
 assert.throws(()=>loadSnapshot(encode([...rows,...additions.slice(1)])),/Partial/);
 assert.throws(()=>loadSnapshot(encode([...rows,...additions.map(r=>r.app==='PASSPORT'?{...r,app:'Unknown'}:r)])),/Invalid/);
});

test('enabled Analytics awaiting validation remains unavailable, never a numeric zero',()=>{
 const pending=text.replaceAll('unavailable_no_analytics_request','unavailable_analytics_pending_validation');
 const model=loadSnapshot(pending);
 assert.equal(aggregate(model,'LoveType','icon_impressions',model.start,model.end).state,'unavailable');
 const rows=parseCSV(pending),row=rows.find(r=>r.data_quality_status==='unavailable_analytics_pending_validation');
 row.value='0';const header=Object.keys(rows[0]);const encode=rs=>[header.join(','),...rs.map(r=>header.map(k=>'"'+String(r[k]).replaceAll('"','""')+'"').join(','))].join('\n');
 assert.throws(()=>loadSnapshot(encode(rows)),/Unavailable metric must be blank/);
});
