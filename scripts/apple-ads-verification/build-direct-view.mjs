// Bundle the accepted Signal layout and existing arithmetic for same-origin delivery.
import fs from'node:fs';import crypto from'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
export function directView(){
 const library=read('scripts/apple-ads-verification/api-export.mjs').replaceAll('export ','');
 let script=read('reporting/portfolio/apple-ads.mjs');
 const marker="try{const r=await fetch('apple-ads-snapshot.json',{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();";
 if(!script.includes(marker))throw Error('Accepted page loader changed; review direct-view bundle');
 script=script.replace(marker,`let lastGood=false;async function refreshReport(){const button=document.querySelector('#refresh');button.disabled=true;try{const r=await fetch('/api/apple-ads/reports/export',{cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(65000)});if(!r.ok)throw Error();const raw=await r.text(),x=JSON.parse(raw);validateAPI(x);
 const midnight=new Date();midnight.setUTCHours(0,0,0,0);const end=new Date(+midnight-86400000).toISOString().slice(0,10),start=new Date(+midnight-28*86400000).toISOString().slice(0,10);
 if(x.scope.start!==start||x.scope.end!==end||x.scope.days!==28||Date.parse(x.queriedAt)>Date.now()+60000)throw Error();
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const snapshots=[apiSnapshot(x,start,end,hash),...weeklySnapshots(x,hash,[])];for(let day=Date.parse(start);day<=Date.parse(end);day+=86400000){const date=new Date(day).toISOString().slice(0,10);snapshots.push(apiSnapshot(x,date,date,hash));}
 for(const s of snapshots){s.source_label='Direct owner API read';s.validation='PASS: API contract and source arithmetic checked; no fresh console control';s.quality=s.observed_campaigns+'/'+s.campaign_count+' stored mapped campaigns have observed rows. Missing rows remain unavailable; current account inventory is not verified. Direct API read; no fresh independent console reconciliation. Baseline 19 Sep–16 Oct 2026 reconciled separately to an official console export. Provider attribution is not verified purchases or revenue.';}
 const d={mode:'historical_official_reports',imported_at:new Date().toISOString(),snapshots};`);
 script=script.replace("for(const[s,i]of d.snapshots", "$('#window').replaceChildren();for(const[s,i]of d.snapshots");
 script=script.replace(' · imported ${d.imported_at}', ' · last successful refresh ${d.imported_at}');
 script=script.replace('Historical API snapshot · totals of observed rows only · ','Direct API read · totals of observed rows only · ');
 script=script.replace("$('#window').onchange=render;render();$('#evidence').hidden=false;}catch{$('#evidence').hidden=true;$('#status').textContent='Official report unavailable. No metrics or replacement data shown.';}","$('#window').onchange=render;render();$('#evidence').hidden=false;lastGood=true;}catch{if(!lastGood)$('#evidence').hidden=true;$('#status').textContent=lastGood?'Refresh failed. Previous successful report retained with its original query and refresh times. No replacement metrics shown.':'Direct report unavailable or sign-in expired. No metrics or replacement data shown.';}finally{button.disabled=false;}}document.querySelector('#refresh').onclick=refreshReport;await refreshReport();");
 if(!script.includes('await refreshReport();')||script.includes("fetch('apple-ads-snapshot.json'"))throw Error('Direct loader generation failed');
 const css=['signal.css','portfolio.css','product.css'].map(p=>read('reporting/portfolio/'+p)).join('\n');
 let html=read('reporting/portfolio/apple-ads.html').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'').replace(/<link rel="stylesheet"[^>]*>/g,'').replace('<script type="module" src="apple-ads.mjs"></script>','').replace('</head>',()=>'<style>'+css+'</style></head>').replace('OFFICIAL APPLE ADS REPORT · HISTORICAL SNAPSHOT','OFFICIAL APPLE ADS REPORT · DIRECT API').replace('Read-only · not a live campaign feed','Read-only · refreshes on open or Refresh · complete reporting days').replace('href="./"','href="/"').replace('<section id="evidence" hidden>','<button id="refresh" type="button">Refresh report</button><section id="evidence" hidden>');
 const combined=library+'\n'+script;html=html.replace('</body>',()=>'<script type="module">'+combined+'</script></body>');
 const digest=s=>crypto.createHash('sha256').update(s).digest('base64');
 return{html,csp:`default-src 'none'; script-src 'sha256-${digest(combined)}'; style-src 'sha256-${digest(css)}'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const output=new URL('apps/tools/src/app/reports/apple-ads/view.generated.ts',root);fs.writeFileSync(output,'// Generated from accepted Signal page: node scripts/apple-ads-verification/build-direct-view.mjs\nexport const directView='+JSON.stringify(directView())+';\n');console.log('Generated same-origin Signal Apple Ads page');}
