// One-off report retrieval only. No writes to Apple, databases, or application code.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createAppStoreConnectToken } from '../../api/aso/_lib/appstore-connect.js';
const root = process.env.ASC_RUN_DIR ? new URL('file://'+process.env.ASC_RUN_DIR+'/') : new URL('./private/', import.meta.url);
const start=process.env.ASC_START||'2026-09-14';
const end=process.env.ASC_END||'2026-10-11';
process.env.APP_STORE_CONNECT_KEY_ID = 'U4MY43N3K6';
process.env.APP_STORE_CONNECT_ISSUER_ID = '131fbc24-b168-44eb-ae44-dc556ffee3eb';
process.env.APP_STORE_CONNECT_PRIVATE_KEY = await fs.readFile(process.env.ASC_PRIVATE_KEY_PATH || '/Users/otastemelis/Downloads/reader/AuthKey_U4MY43N3K6.p8', 'utf8');
let log = [];try{log=JSON.parse(await fs.readFile(new URL('retrieval-log.json',root),'utf8'))}catch{}
export async function get(path, name) {
  const url = new URL(path, 'https://api.appstoreconnect.apple.com');
  if (url.origin !== 'https://api.appstoreconnect.apple.com') throw Error('Unexpected API host');
  const response = await fetch(url, {method:'GET',headers:{Authorization:`Bearer ${createAppStoreConnectToken()}`},redirect:'error',signal:AbortSignal.timeout(30000)});
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(new URL(name, root), bytes, {mode:0o600});
  log.push({path:url.pathname+url.search,file:name,status:response.status,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString()});
  await fs.writeFile(new URL('retrieval-log.json', root), JSON.stringify(log,null,2),{mode:0o600});
  let body;try{body=JSON.parse(bytes.toString())}catch{body=null}
  if(!response.ok) throw Error(`Apple GET ${response.status}: ${body?.errors?.map(e=>e.title).join('; ')||'request failed'}`);
  return body;
}
export async function all(path, prefix) {
  const rows=[];let page=0;
  while(path){const b=await get(path,`${prefix}-${page++}.json`);rows.push(...b.data);path=b.links?.next;if(page>30)throw Error('Unexpected pagination depth');}
  return rows;
}
if(process.argv[2]==='inventory'){
 for(const [app,id] of [['InnerType','6785764991'],['LoveType','6786477464']]){
  const requests=await all(`/v1/apps/${id}/analyticsReportRequests?limit=200`,`${app}-requests`);
  console.log(JSON.stringify({app,requests:requests.map(r=>({id:r.id,...r.attributes}))}));
  for(const request of requests){
   const reports=await all(`/v1/analyticsReportRequests/${request.id}/reports?limit=200`,`${app}-${request.id}-reports`);
   console.log(JSON.stringify({app,request:request.id,reports:reports.filter(r=>/Downloads Standard|Purchases Standard|Discovery and Engagement Standard/.test(r.attributes.name)).map(r=>({id:r.id,...r.attributes}))}));
  }
 }
}
if(process.argv[2]==='instances'){
 const request='039b8aed-2f0e-4b5e-b0f6-e9afe4b0cd6a';
 for(const [kind,id] of [['discovery',`r14-${request}`],['downloads',`r3-${request}`],['purchases',`r12-${request}`]]){
  const instances=await all(`/v1/analyticsReports/${id}/instances?filter%5Bgranularity%5D=DAILY&limit=200`,`InnerType-${kind}-instances`);
  console.log(JSON.stringify({kind,count:instances.length,instances:instances.map(x=>({id:x.id,...x.attributes}))}));
 }
}
if(process.argv[2]==='latest'){
 for(const kind of ['discovery','downloads','purchases']){
  const b=JSON.parse(await fs.readFile(new URL(`InnerType-${kind}-instances-0.json`,root),'utf8'));
  const instance=b.data.toSorted((a,b)=>b.attributes.processingDate.localeCompare(a.attributes.processingDate))[0];
  const segments=await all(`/v1/analyticsReportInstances/${instance.id}/segments?limit=200`,`InnerType-${kind}-${instance.id}-segments`);
  console.log(JSON.stringify({kind,processingDate:instance.attributes.processingDate,segments:segments.map(s=>({id:s.id,host:new URL(s.attributes.url).hostname,size:s.attributes.sizeInBytes,checksum:s.attributes.checksum}))}));
  for(const segment of segments){
   const url=new URL(segment.attributes.url);
   if(url.protocol!=='https:'||!(url.hostname.endsWith('.apple.com')||url.hostname==='asp-us-west-2.s3.us-west-2.amazonaws.com'))throw Error('Unexpected report download host');
   const r=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw Error(`Segment GET ${r.status}`);
   const bytes=Buffer.from(await r.arrayBuffer());
   const text=(bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes).toString('utf8');
   await fs.writeFile(new URL(`InnerType-${kind}-${instance.id}-${segment.id}.tsv`,root),text,{mode:0o600});
   console.log(JSON.stringify({kind,lines:text.trim().split('\n').length,preview:text.split('\n').slice(0,3)}));
  }
 }
}
if(process.argv[2]==='download'){
 const manifest=[];
 for(const kind of ['discovery','downloads','purchases']){
  const b=JSON.parse(await fs.readFile(new URL(`InnerType-${kind}-instances-0.json`,root),'utf8'));
  const instances=b.data.filter(i=>i.attributes.processingDate>=start).toSorted((a,b)=>a.attributes.processingDate.localeCompare(b.attributes.processingDate));
  for(const instance of instances){
   const segments=await all(`/v1/analyticsReportInstances/${instance.id}/segments?limit=200`,`InnerType-${kind}-${instance.id}-segments`);
   for(const segment of segments){
    const url=new URL(segment.attributes.url);
    if(url.protocol!=='https:'||url.hostname!=='asp-us-west-2.s3.us-west-2.amazonaws.com')throw Error('Unexpected report storage host');
    const r=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error(`Segment GET ${r.status}`);
    const bytes=Buffer.from(await r.arrayBuffer());
    const checksum=createHash('md5').update(bytes).digest('hex');
    if(segment.attributes.checksum&&checksum!==segment.attributes.checksum)throw Error('Apple segment checksum mismatch');
    if(segment.attributes.sizeInBytes!==undefined&&bytes.length!==segment.attributes.sizeInBytes)throw Error('Apple segment size mismatch');
    const filename=`InnerType-${kind}-${instance.id}-${segment.id}.tsv`;
    const text=(bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes).toString('utf8');
    await fs.writeFile(new URL(filename,root),text,{mode:0o600});
    await fs.writeFile(new URL(filename+'.gz',root),bytes,{mode:0o600});
    manifest.push({app:'InnerType',kind,instanceId:instance.id,processingDate:instance.attributes.processingDate,segmentId:segment.id,filename,md5:checksum,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,checksumVerified:true,retrievedAt:new Date().toISOString()});
   }
  }
  console.log(JSON.stringify({kind,instances:instances.length,segments:manifest.filter(m=>m.kind===kind).length}));
 }
 await fs.writeFile(new URL('segment-manifest.json',root),JSON.stringify(manifest,null,2),{mode:0o600});
}
if(['sales','sales-weekly'].includes(process.argv[2])){
 const manifest=[];
 const weekly=process.argv[2]==='sales-weekly';
 for(let date=new Date((weekly?process.env.ASC_WEEK_START||'2026-09-20':start)+'T00:00:00Z');date<=new Date(end+'T00:00:00Z');date=new Date(+date+(weekly?7:1)*86400000)){
  const day=date.toISOString().slice(0,10);
  const params=new URLSearchParams({'filter[frequency]':weekly?'WEEKLY':'DAILY','filter[reportSubType]':'SUMMARY','filter[reportType]':'SALES','filter[vendorNumber]':'94513883','filter[version]':'1_0','filter[reportDate]':day});
  const r=await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`,{method:'GET',headers:{Authorization:`Bearer ${createAppStoreConnectToken()}`,Accept:'application/a-gzip'},redirect:'error',signal:AbortSignal.timeout(30000)});
  const bytes=Buffer.from(await r.arrayBuffer());
  const filename=`Sales-${weekly?'weekly-':''}${day}`;
  await fs.writeFile(new URL(filename+(r.ok?'.gz':'.error.json'),root),bytes,{mode:0o600});
  if(r.ok){
   const text=(bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes).toString('utf8');
   await fs.writeFile(new URL(filename+'.tsv',root),text,{mode:0o600});
  }
  manifest.push({date:day,status:r.status,filename:filename+(r.ok?'.tsv':'.error.json'),sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString()});
  if(!r.ok&&r.status!==404)throw Error(`Sales report ${day}: ${r.status}`);
 }
 await fs.writeFile(new URL(weekly?'sales-weekly-manifest.json':'sales-manifest.json',root),JSON.stringify(manifest,null,2),{mode:0o600});
 console.log(JSON.stringify({salesDays:manifest.length,statuses:manifest.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{})}));
}
