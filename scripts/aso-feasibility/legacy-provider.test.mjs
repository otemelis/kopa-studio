// Diagnostic tests of retained legacy behavior, not approval to use it as organic rank.
// Synthetic responses are explicit test inputs. No external request, DB write, or collector run.
import test from 'node:test';import assert from 'node:assert/strict';import{searchApps}from'../../api/aso/_lib/providers.js';
const realFetch=globalThis.fetch,realNow=Date.now;let time=realNow(),calls=0,body;
Date.now=()=>time+=10000;globalThis.fetch=async()=>{calls++;return{status:200,ok:true,json:async()=>body};};
test('DIAGNOSTIC: schema error is silently indistinguishable from successful empty results',async()=>{body={error:'unexpected schema'};assert.deepEqual(await searchApps('fixture-schema','de',100),[]);});
test('DIAGNOSTIC: filtering invalid IDs renumbers the remaining result slots',async()=>{body={resultCount:3,results:[{trackId:11,trackName:'Fixture A'},{trackName:'Malformed slot'},{trackId:22,trackName:'Fixture B'}]};const rows=await searchApps('fixture-slots','de',100);assert.equal(rows[1].position,2);assert.equal(body.results.findIndex(x=>x.trackId===22)+1,3);});
test('DIAGNOSTIC: repeated request returns cached body, not a new observation',async()=>{body={results:[{trackId:11}]};const before=calls;await searchApps('fixture-cache','de',100);body={results:[{trackId:22}]};const second=await searchApps('fixture-cache','de',100);assert.equal(calls-before,1);assert.equal(second[0].store_app_id,'11');});
test.after(()=>{globalThis.fetch=realFetch;Date.now=realNow;});
