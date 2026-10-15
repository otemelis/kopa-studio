// Explicit isolated synthetic regression database. Never run against hosted source.
import assert from 'node:assert/strict';import{createRequire}from'node:module';import * as q from './queries.mjs';
if(!process.env.KOPA_TEST_SOCKET?.startsWith('/private/tmp/kopa-sql-test-'))throw Error('Isolated local test socket required');
const {Client}=createRequire(new URL('../../apps/tools/package.json',import.meta.url))('pg');const c=new Client({host:process.env.KOPA_TEST_SOCKET,port:54338,database:'postgres'});await c.connect();try{
await c.query(`CREATE SCHEMA form;CREATE TABLE form.events(event_id text,installation_id text,event_name text,occurred_at timestamptz,received_at timestamptz,session_id text,properties jsonb,build_channel text)`);
let id=0;const add=async(i,name,time,props={},session=null,channel='testflight')=>c.query('INSERT INTO form.events VALUES($1,$2,$3,$4,$4,$5,$6,$7)',[String(++id),i,name,time,session,props,channel]);
for(const i of['A','B']){await add(i,'app_opened','2026-10-01T01:00Z',{first_launch:true});await add(i,'onboarding_started','2026-10-01T01:01Z');await add(i,'onboarding_completed','2026-10-01T01:02Z');await add(i,'session_started','2026-10-01T01:03Z',{session_number:1},i);}
await add('A','session_ended','2026-10-01T01:04Z',{tracked_seconds:90},'A');await add('A','paywall_viewed','2026-10-01T01:05Z');await add('A','purchase_completed','2026-10-01T01:06Z',{is_trial:true});
await add('B','session_ended','2026-10-01T01:04Z',{tracked_seconds:999},'wrong'); // cannot match session
await add('B','paywall_viewed','2026-10-01T01:00Z'); // prior to sequence, not a funnel conversion
await add('A','app_foregrounded','2026-10-02T23:59Z');await add('A','app_opened','2026-10-08T01:00Z');
await add('late','onboarding_started','2026-10-14T23:00Z'); // immature 24-hour entry
await add('prod','app_opened','2026-10-02T01:00Z',{},null,'appstore');
const args=['testflight','2026-10-01T00:00Z','2026-10-15T00:00Z'];const run=async(sql,a=args)=>(await c.query(sql,a)).rows;
assert.deepEqual((await run(q.funnelSQL))[0],{entrants:3,eligible:2,completed:2,started:2,finished:1,paywall:1,purchase:1});
assert.deepEqual((await run(q.retentionSQL,[...args,1]))[0],{eligible:2,returned:1});assert.deepEqual((await run(q.retentionSQL,[...args,7]))[0],{eligible:2,returned:1});
assert.deepEqual((await run(q.usageSQL))[0],{started:2,matched_completed:1,tracked_seconds:90});assert.equal((await run(q.activeSQL))[0].value,3);assert.equal((await run(q.firstSQL))[0].value,2);
assert.equal((await run(q.activeSQL,['appstore',...args.slice(1)]))[0].value,1);assert.equal((await run(q.activeSQL,['appstore','2025-01-01','2025-02-01']))[0].value,0);
console.log('PASS actual SQL: ordered and mature funnel, same-session join, D1/D7, event order, usage, identity grain, environment isolation, empty period');
}finally{await c.end();}
