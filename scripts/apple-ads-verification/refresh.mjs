// Manual saved-owner-export refresh. Reuse both existing validators before publishing.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import{spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';import{validateAPI}from'./api-export.mjs';import{validate}from'./validate.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function refreshScope(x,controls,now=new Date()){
 validateAPI(x);const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-86400000).toISOString().slice(0,10),start=new Date(Date.parse(end)-27*86400000).toISOString().slice(0,10);
 if(x.scope.start!==start||x.scope.end!==end||x.scope.days!==28)throw Error(`Fresh refresh requires ${start} through ${end} UTC`);
 if(Date.parse(x.queriedAt)>now.getTime()+60000)throw Error('Future query timestamp');
 if(!controls.some(c=>c.period_start===start&&c.period_end===end))throw Error('Matching full-window official console control required');
 return{start,end};
}
export function refresh(source,controlFiles,{checkOnly=false,outputRoot=root}={}){
 if(!source||!controlFiles.length)throw Error('Usage: node scripts/apple-ads-verification/refresh.mjs [--check-only] export.json console.csv [extra.csv ...]');
 const inputs=[source,...controlFiles].map(p=>path.resolve(p)),x=JSON.parse(fs.readFileSync(inputs[0])),controls=inputs.slice(1).map(p=>validate(fs.readFileSync(p,'utf8')));
 validateAPI(x);if(!checkOnly)refreshScope(x,controls);
 const stage=fs.mkdtempSync(path.join(os.tmpdir(),'kopa-ads-check-'));
 try{
  const env={...process.env,KOPA_ADS_OUTPUT_ROOT:stage};
  const run=(bin,args)=>{const r=spawnSync(bin,args,{cwd:root,env,encoding:'utf8',maxBuffer:2e6});if(r.status!==0)throw Error('Reconciliation failed: '+(r.stderr||r.error?.message||'unknown'));return JSON.parse(r.stdout);};
  const js=run(process.execPath,['scripts/apple-ads-verification/publish-api.mjs',...inputs]);
  const independent=run('python3',['scripts/apple-ads-verification/reconcile-api.py',...inputs]);
  const evidence={checkedAt:new Date().toISOString(),mode:checkOnly?'check_only_no_publication':'manual_refresh',sourceQueriedAt:x.queriedAt,scope:x.scope,sourceSha256:js.source_sha256,independent,fullWindowConsoleReconciled:controls.some(c=>c.period_start===x.scope.start&&c.period_end===x.scope.end)};
  if(!checkOnly){
   // No live file changes before both validators pass. Publish the browser snapshot last.
   for(const name of ['api-export-validation.json','apple-ads-daily.csv']){const dest=path.join(outputRoot,'docs/milestones/m6',name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(stage,'docs/milestones/m6',name),dest+'.tmp');fs.renameSync(dest+'.tmp',dest);}
   const dest=path.join(outputRoot,'reporting/portfolio/apple-ads-snapshot.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(stage,'reporting/portfolio/apple-ads-snapshot.json'),dest+'.tmp');fs.renameSync(dest+'.tmp',dest);
  }
  return evidence;
 }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const args=process.argv.slice(2),checkOnly=args[0]==='--check-only';if(checkOnly)args.shift();console.log(JSON.stringify(refresh(args[0],args.slice(1),{checkOnly}),null,2));}
