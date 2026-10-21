import{createRefreshControl,refreshRequest}from'./app-store-refresh.mjs';
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import * as q from './queries.mjs';import {scope,ratio,fillDays} from './model.mjs';
const root=fileURLToPath(new URL('../../reporting/portfolio/',import.meta.url));
const {Client}=createRequire(new URL('../../apps/tools/package.json',import.meta.url))('pg');
async function report(s){
 const privatePath=process.env.KOPA_READER_CONFIG;if(!privatePath)throw new Error('Private SQL configuration unavailable');
 const config=JSON.parse(await fs.readFile(privatePath));const ca=await fs.readFile(process.env.KOPA_READER_CA,'utf8');
 const client=new Client({...config,ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:7000,query_timeout:6000});
 try {await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 // A SELECT grant without an applicable RLS policy can silently return zero. Refuse that state.
 const policy=await client.query(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname=$1 AND tablename=$2 AND cmd='SELECT' AND 'kopa_report_reader'=ANY(roles)`,[s.app==='pois'?'form':'passport_analytics',s.app==='pois'?'events':'daily_counts']);if(policy.rows[0].n!==1)throw new Error('Required source read policy unavailable');
 const run=async(sql,args=[s.environment,s.start,s.end])=>(await client.query(sql,args)).rows;
 const coverage=(await run(s.app==='pois'?q.coverageSQL:q.passportCoverageSQL,[s.environment]))[0];
 const result={...s,checkedAt:new Date().toISOString(),coverage,status:coverage.total?'observed':s.environment==='appstore'?'production_not_observed':'no_data_yet',source:s.app==='pois'?'Supabase form.events':'Supabase passport_analytics.daily_counts'};
 if(s.app==='pois'){
 const events=await run(q.eventSQL),count=name=>events.find(e=>e.event_name===name)?.installations??0;
 const purchases=await run(q.purchaseSQL);result.metrics={active:(await run(q.activeSQL))[0].value,firstOpen:(await run(q.firstSQL))[0].value,onboarding:count('onboarding_completed'),activation:count('session_started'),paywall:count('paywall_viewed'),trial:purchases.find(x=>x.is_trial==='true')?.value??0,nonTrial:purchases.find(x=>x.is_trial==='false')?.value??0,purchaseUnknown:purchases.find(x=>x.is_trial===null)?.value??0};
 result.events=events;result.daily=fillDays(s,await run(q.dailySQL));result.funnel=(await run(q.funnelSQL))[0];result.retention={};for(const day of[1,7]){const r=(await run(q.retentionSQL,[s.environment,s.start,s.end,day]))[0];result.retention['d'+day]=ratio(r.returned,r.eligible);}result.usage=(await run(q.usageSQL))[0];
 }else {result.dailyEvents=await run(q.passportSQL);result.metrics=null;result.identityStatus='unavailable_anonymous_aggregates';result.quality='Retry replay protection not deployed; aggregate counts may duplicate. Device-local day; upload-time build/channel.';}
 await client.query('COMMIT');return result;
 }finally{await client.end();}
}
const ascRefresh=createRefreshControl();
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv','.md':'text/plain'};
http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/app-store/refresh'){refreshRequest(req,res,Number(process.env.PORT??4340),ascRefresh);return;}if(url.pathname==='/api/product'){const s=scope(url.searchParams.get('app'),url.searchParams.get('environment'),url.searchParams.get('days'));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await report(s)));return;}
 const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const target=path.resolve(root,name);if(!target.startsWith(root)||name.startsWith('.')||!types[path.extname(target)]){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(target)]);res.end(await fs.readFile(target));}catch(e){res.writeHead(req.url.startsWith('/api/')?503:404,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'unavailable',message:'Source query failed. No substitute data is shown.'}));console.error('Kopa source request failed:',e.code??e.message);}}).listen(Number(process.env.PORT??4340),'127.0.0.1',()=>console.log('Kopa read-only portfolio + product analytics: http://127.0.0.1:'+(process.env.PORT??4340)));
