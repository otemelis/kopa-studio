import {renderLaunch} from './launch.mjs';
import {APPS,METRICS,SOURCE_SHA256,verifySource,loadSnapshot,aggregate,period,difference} from './model.mjs';
import {refreshHealth} from './refresh-health.mjs';
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
const range=w=>`${date(w.start)} – ${date(w.end)}`;
function evidence(value,metric,ctx,currency='',operation='sum'){
  const exact=metric.unit==='money'?(value/100).toFixed(2):String(value);
  const shown=metric.unit==='money'?(value/100).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}):value.toLocaleString('en-GB');
  const attrs={app:ctx.app,metric:metric.key,currency,start:ctx.start,end:ctx.end,operation,number:exact};
  if(operation==='delta'){attrs.priorStart=ctx.previous.start;attrs.priorEnd=ctx.previous.end;}
  return `<span ${Object.entries(attrs).map(([k,v])=>`data-${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${escape(v)}"`).join(' ')}>${shown}</span>`;
}
function amounts(result,metric,ctx,compact=false){
  if(result.state!=='available')return '<span class="unavailable">Unavailable</span>';
  const value=result.amounts.map(a=>`<span class="portfolio-amount">${a.currency?`<span class="currency">${escape(a.currency)}</span>`:''}${evidence(a.value,metric,ctx,a.currency)}</span>`).join('');
  return value+(metric.unit==='money'&&result.amounts.every(a=>!a.currency)&&!compact?'<span class="zero-note">No revenue-bearing rows</span>':'');
}
function comparison(current,previous,metric,ctx){
  const delta=difference(current,previous);
  if(!delta)return '';
  return `<div class="portfolio-delta">${delta.map((a,i)=>`<span>Change <strong>${a.currency?escape(a.currency)+' ':''}${a.value>0?'+':''}${evidence(a.value,metric,ctx,a.currency,'delta')}</strong> · prior ${a.currency?escape(a.currency)+' ':''}${evidence(previous.amounts[i].value,metric,{...ctx,...ctx.previous},a.currency)}</span>`).join('')}</div>`;
}
function render(snapshot,days){
  const w=period(snapshot,days);
  renderLaunch(snapshot,days);
  document.querySelectorAll('[data-days]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.days)===days)));
  $('#period-label').textContent=range(w)+' '+w.end.slice(0,4);
  $('#comparison-note').textContent=w.comparable?`Compared with ${range(w.previous)} ${w.previous.end.slice(0,4)}. Changes use the same metric, units and currency.`:'Previous-period comparison unavailable: the preceding period is not included in this CSV.';
  $('#apps').innerHTML=APPS.map(app=>`<article class="portfolio-app"><header class="portfolio-app-title"><span class="portfolio-app-icon ${app==='LoveType'?'love':''}">${app[0]}</span><h2>${app}</h2><span class="portfolio-badge">OFFICIAL CSV SNAPSHOT</span></header><div class="portfolio-metrics">${METRICS.map(metric=>{
    const ctx={...w,app},current=aggregate(snapshot,app,metric.key,w.start,w.end),previous=aggregate(snapshot,app,metric.key,w.previous.start,w.previous.end);
    return `<section class="portfolio-metric"><h3>${metric.label}</h3><div class="portfolio-value ${current.state!=='available'?'unavailable':''}">${amounts(current,metric,ctx)}</div>${comparison(current,previous,metric,ctx)}<p>${current.state==='unavailable'?'No Analytics report in this snapshot':metric.note}</p></section>`;
  }).join('')}</div></article>`).join('');
  const downloadMetric=METRICS[0];
  const max=Math.max(1,...APPS.flatMap(app=>w.weeks.map(week=>{
    const result=aggregate(snapshot,app,downloadMetric.key,week.start,week.end);
    return result.state==='available'?result.amounts[0].value:0;
  })));
  $('#trends').innerHTML=APPS.map(app=>{
    const download=METRICS[0],buckets=w.weeks.map(week=>({week,result:aggregate(snapshot,app,download.key,week.start,week.end)}));
    return `<div class="portfolio-trend-card ${app==='LoveType'?'love':''}"><h3>${app} <small>· first-time downloads</small></h3><div class="portfolio-spark" aria-label="Weekly first-time downloads">${buckets.map(b=>`<div class="portfolio-spark-week ${b.week.previous?'previous':''}"><div class="portfolio-spark-value">${amounts(b.result,download,{app,...b.week},true)}</div><div class="portfolio-spark-bar" data-height="${b.result.state==='available'?b.result.amounts[0].value/max*52:0}" title="${escape(range(b.week))}"></div></div>`).join('')}</div><div class="portfolio-week-scroll"><table class="portfolio-week-table"><thead><tr><th scope="col">Metric</th>${w.weeks.map(week=>`<th scope="col">${week.previous?'Prior · ':''}${range(week)}</th>`).join('')}</tr></thead><tbody>${METRICS.map(metric=>`<tr><td>${metric.label}</td>${w.weeks.map(week=>`<td>${amounts(aggregate(snapshot,app,metric.key,week.start,week.end),metric,{app,...week},true)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }).join('');
  document.querySelectorAll('[data-height]').forEach(bar=>{bar.style.height=bar.dataset.height+'px';});
}
try{
  const stored=localStorage.getItem('kopa-portfolio-theme');if(stored==='light'||stored==='dark')document.documentElement.dataset.theme=stored;
}catch{}
const theme=$('[aria-label="Appearance"]');theme.value=document.documentElement.dataset.theme;
theme.addEventListener('change',()=>{document.documentElement.dataset.theme=theme.value;document.documentElement.style.colorScheme=theme.value;try{localStorage.setItem('kopa-portfolio-theme',theme.value);}catch{}});
try{
  const metadata=await fetch('./current.json',{cache:'no-store'});
  if(!metadata.ok)throw Error('Refresh metadata unavailable');
  const manifest=await metadata.json();
  if(!/^daily-[a-f0-9]{64}\.csv$/.test(manifest.csv)||! /^[a-f0-9]{64}$/.test(manifest.sha256)||!Number.isFinite(Date.parse(manifest.last_successful_refresh_utc)))throw Error('Invalid refresh metadata');
  const response=await fetch('./'+manifest.csv,{cache:'no-store'});
  if(!response.ok)throw Error('CSV read failed');
  const bytes=await response.arrayBuffer();await verifySource(bytes,manifest.sha256);
  const snapshot=loadSnapshot(new TextDecoder().decode(bytes));
  render(snapshot,28);
  $('#source-stamp').textContent=`Full CSV coverage: ${date(snapshot.start)} – ${date(snapshot.end)} ${snapshot.end.slice(0,4)}. Extracted ${date(snapshot.extracted)} ${snapshot.extracted.slice(0,4)}. Last successful refresh: ${manifest.last_successful_refresh_utc}. Manually refreshed historical snapshot.`;
  if(snapshot.start!==manifest.period_start||snapshot.end!==manifest.period_end)throw Error('Refresh period mismatch');
  let attempt=null;try{const r=await fetch('./refresh-status.json',{cache:'no-store'});if(r.ok)attempt=await r.json();}catch{}
  $('#refresh-health').textContent=refreshHealth(manifest,attempt).message;
  $('#source-hash').textContent=manifest.sha256;
  document.querySelector('a[download]').href=manifest.csv;
  document.querySelectorAll('[data-days]').forEach(b=>{b.disabled=false;b.addEventListener('click',()=>render(snapshot,Number(b.dataset.days)));});
  $('#report').hidden=false;$('#status').hidden=true;
}catch{
  $('#report').hidden=true;$('#status').hidden=false;
  renderLaunch(null,28);
  $('#status').textContent='Snapshot unavailable. The CSV could not be read or verified. No metrics are shown.';
}
