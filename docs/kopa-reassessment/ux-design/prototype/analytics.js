(function(root){
'use strict';
const DAY=86400000, iso=d=>new Date(d).toISOString().slice(0,10), shift=(d,n)=>iso(Date.parse(d+'T00:00:00Z')+n*DAY);
function dates(start,end){const a=[];for(let d=start;d<=end;d=shift(d,1))a.push(d);return a;}
function windowFor(end,n){return {start:shift(end,1-n),end};}
function prior(w){const n=dates(w.start,w.end).length;return windowFor(shift(w.start,-1),n);}
function inWindow(rows,w){return rows.filter(r=>r.date>=w.start&&r.date<=w.end);}
const comparable=p=>p.status==='observed'&&p.method==='vendor_observation';
function rankSummary(rows,w){const r=inWindow(rows,w),v=r.filter(comparable),values=v.map(p=>p.rank),expected=dates(w.start,w.end).length;
 const mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null, collected=r.filter(p=>p.method==='vendor_observation'&&['observed','absent'].includes(p.status)).length;
 return {mean,volatility:mean===null?null:Math.sqrt(values.reduce((s,n)=>s+(n-mean)**2,0)/values.length),first:v[0]??null,last:v.at(-1)??null,collected,expected,coverage:collected/expected,observed:values.length,legacy:r.some(p=>p.method==='itunes_search_position')};}
function movement(current,previous){return current==null||previous==null?null:previous-current;}
function percent(current,previous){return previous?100*(current-previous)/previous:null;}
function rankY(rank,max,height,top=20){return top+(rank-1)/(max-1)*(height-top-34);}
function segments(points,value=p=>p.rank){const result=[];let run=[],lastMethod=null;
 for(const p of points){const valid=p.status==='observed'&&Number.isFinite(value(p));if(!valid||lastMethod!==null&&p.method!==lastMethod){if(run.length)result.push(run);run=[];}if(valid)run.push(p);lastMethod=p.method;}if(run.length)result.push(run);return result;}
function sums(rows,w){const r=inWindow(rows,w);const t=r.reduce((s,p)=>({downloads:s.downloads+p.downloads,spend:s.spend+p.spend,taps:s.taps+p.taps,installs:s.installs+p.installs,impressions:s.impressions+p.impressions,proceeds:s.proceeds+p.proceeds}),{downloads:0,spend:0,taps:0,installs:0,impressions:0,proceeds:0});return {...t,cpa:t.installs?t.spend/t.installs:null};}
function periodPair(w,mode,custom){return mode==='off'?null:mode==='custom'?custom:prior(w);}
function csv(rows){const keys=[...new Set(rows.flatMap(Object.keys))];const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n');}
const api={DAY,iso,shift,dates,windowFor,prior,inWindow,rankSummary,movement,percent,rankY,segments,sums,periodPair,csv};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KopaAnalytics=api;
})(globalThis);
