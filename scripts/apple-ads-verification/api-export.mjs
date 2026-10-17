// Local saved-export validation only. No network, credentials or database writes.
export const countFields=['impressions','taps','tapInstalls','viewInstalls','totalInstalls','newDownloads','redownloads'];
export const fieldMap={'Impressions':'impressions','Taps':'taps','Installs (Tap-Through)':'tapInstalls','Installs (View-Through)':'viewInstalls','Installs (Total)':'totalInstalls','New Downloads (Total)':'newDownloads','Redownloads (Total)':'redownloads'};
function date(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Invalid date');return Date.parse(s);}
export function decimalSum(values){const scale=Math.max(0,...values.map(v=>{if(typeof v!=='string'||!/^\d+(?:\.\d+)?$/.test(v))throw Error('Invalid decimal');return(v.split('.')[1]??'').length;}));const units=values.reduce((n,v)=>{const[a,b='']=v.split('.');return n+BigInt(a+b.padEnd(scale,'0'));},0n);return scale?String(units).padStart(scale+1,'0').replace(new RegExp(`(.{${scale}})$`),'.$1'):String(units);}
export function cents(value,denominator=1){if(!Number.isSafeInteger(denominator)||denominator<1)throw Error('Invalid denominator');const[a,b='']=value.split('.'),n=BigInt(a+b)*100n,d=10n**BigInt(b.length)*BigInt(denominator),scaled=(2n*n+d)/(2n*d);if(scaled>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Amount too large');return Number(scaled);}
export function validateAPI(x){
 if(!x||x.error||x.source!=='Apple Ads legacy v5 report (existing provider)'||x.scope?.timezone!=='UTC'||x.databaseWrites!==0||x.grain!=='campaign/day/all campaign markets'||!Number.isFinite(Date.parse(x.queriedAt)))throw Error('Invalid export provenance');
 const days=(date(x.scope.end)-date(x.scope.start))/86400000+1;if(days<1||days>28||days!==x.scope.days||Date.parse(x.queriedAt)<date(x.scope.end)+86400000)throw Error('Invalid period');
 if(!Array.isArray(x.reports)||!x.reports.length||x.reports.length>10)throw Error('Invalid campaign coverage');const ids=new Set();let rows=0;
 for(const c of x.reports){if(!/^\d+$/.test(c.campaignId)||ids.has(c.campaignId)||c.appStoreId!=='6785764991'||!Array.isArray(c.rows))throw Error('Invalid/duplicate campaign or unsupported app');ids.add(c.campaignId);const dates=new Set();
 for(const r of c.rows){date(r.date);if(r.date<x.scope.start||r.date>x.scope.end||dates.has(r.date)||r.campaignId!==c.campaignId||r.currency!=='EUR')throw Error('Invalid row scope');dates.add(r.date);for(const k of countFields)if(!Number.isSafeInteger(r[k])||r[k]<0)throw Error('Missing/invalid count');decimalSum([r.spend]);if(r.tapInstalls+r.viewInstalls!==r.totalInstalls||r.newDownloads+r.redownloads!==r.totalInstalls)throw Error('Attribution mismatch');rows++;}
 if(c.missingDays!==days-dates.size||c.status!==(c.rows.length?'observed':'no_reported_rows'))throw Error('Inconsistent coverage metadata');}
 return{campaigns:x.reports.length,observedCampaigns:x.reports.filter(c=>c.rows.length).length,observedRows:rows,expectedCampaignDays:days*x.reports.length,unreportedCampaignDays:days*x.reports.length-rows};
}
export function totals(rows){return{...Object.fromEntries(countFields.map(k=>[k,rows.reduce((n,r)=>n+r[k],0)])),spend:decimalSum(rows.map(r=>r.spend))};}
export function reconcileCSV(x,s){validateAPI(x);if(s.timezone!=='UTC'||s.currency!=='EUR'||s.period_start<x.scope.start||s.period_end>x.scope.end)throw Error('Incomparable console scope');if(s.campaigns.length!==x.reports.length||s.campaigns.some(c=>!x.reports.some(r=>r.campaignId===c.campaign_id)))throw Error('Campaign inventory differs');
 const comparisons=s.campaigns.map(c=>{const report=x.reports.find(r=>r.campaignId===c.campaign_id),rows=report.rows.filter(r=>r.date>=s.period_start&&r.date<=s.period_end);if(!rows.length)return{campaignId:c.campaign_id,result:'UNAVAILABLE: API has no rows; console-reported values retained independently',consoleMetrics:c.metrics};const t=totals(rows);for(const[k,f]of Object.entries(fieldMap))if(t[f]!==c.metrics[k])throw Error('Console count mismatch: '+k);if(cents(t.spend)!==c.metrics.Spend)throw Error('Console spend mismatch');return{campaignId:c.campaign_id,result:'PASS: reported count sums match; exact API spend rounds to console amount',apiSpendExact:t.spend,consoleSpendCents:c.metrics.Spend,observedDays:rows.length};});
 const observed=x.reports.flatMap(c=>c.rows).filter(r=>r.date>=s.period_start&&r.date<=s.period_end),t=totals(observed);for(const[k,f]of Object.entries(fieldMap))if(t[f]!==s.totals_in_cents_for_spend[k])throw Error('Console footer count mismatch');if(cents(t.spend)!==s.totals_in_cents_for_spend.Spend)throw Error('Console footer spend mismatch');
 return{periodStart:s.period_start,periodEnd:s.period_end,result:'PASS: observed API sums match console footer; absent campaign rows are not independently confirmed zeros',apiSpendExact:t.spend,consoleSpendCents:s.totals_in_cents_for_spend.Spend,comparisons};
}
export function apiSnapshot(x,start,end,hash){
 validateAPI(x);if(date(start)>date(end)||start<x.scope.start||end>x.scope.end)throw Error('Snapshot outside validated source period');
const campaigns=x.reports.map(c=>{const rows=c.rows.filter(r=>r.date>=start&&r.date<=end),t=rows.length?totals(rows):null;return{campaign_id:c.campaignId,name:c.campaignName,app:'InnerType Personality Test',market:'Not supplied',reported_status:rows.length?'Observed rows':'No reported rows',metrics:t?{Spend:cents(t.spend),...Object.fromEntries(Object.entries(fieldMap).map(([k,f])=>[k,t[f]]))}:null,spend_exact:t?.spend??null,cpa_cents:t&&t.totalInstalls>0?cents(t.spend,t.totalInstalls):null,observed_days:rows.length};});const rows=x.reports.flatMap(c=>c.rows).filter(r=>r.date>=start&&r.date<=end),t=totals(rows),observed=campaigns.filter(c=>c.metrics).length;return{period_start:start,period_end:end,timezone:'UTC',currency:'EUR',source_kind:'api_export',source_label:'Saved owner API export',queried_at:x.queriedAt,source_sha256:hash,grain:'Observed campaign/day rows; absent rows remain unavailable',campaign_count:campaigns.length,observed_campaigns:observed,totals_in_cents_for_spend:rows.length?{Spend:cents(t.spend),...Object.fromEntries(Object.entries(fieldMap).map(([k,f])=>[k,t[f]]))}:null,spend_exact:rows.length?t.spend:null,cpa_cents:rows.length&&t.totalInstalls>0?cents(t.spend,t.totalInstalls):null,campaigns,validation:'PASS: saved export structure validated; external controls must be checked separately',quality:`${observed}/${campaigns.length} mapped campaigns have observed rows. Totals include reported rows only; this is not a verified account-wide total. Spend summed at source precision before display rounding. External console coverage is determined by the supplied control files, not by source dates.`};}

function shiftDay(day, n){return new Date(date(day)+n*86400000).toISOString().slice(0,10);}
function spendDifference(current, previous){
 const scale=Math.max((current.split('.')[1]??'').length,(previous.split('.')[1]??'').length);
 const units=value=>{const[a,b='']=value.split('.');return BigInt(a+b.padEnd(scale,'0'));};
 const delta=units(current)-units(previous),absolute=delta<0n?-delta:delta;
 const digits=String(absolute).padStart(scale+1,'0');
 const exact=(delta<0n?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
 return {exact,cents:(delta<0n?-1:1)*cents(exact.replace(/^-/,''))};
}
export function weeklySnapshots(x,hash,controlWindows=[]){
 validateAPI(x);const snapshots=[];
 for(let end=x.scope.end;shiftDay(end,-6)>=x.scope.start;end=shiftDay(end,-7)){
  const start=shiftDay(end,-6),current=apiSnapshot(x,start,end,hash);
  current.window_kind='seven_complete_days';current.window_label='7 days';
  const priorStart=shiftDay(start,-7),priorEnd=shiftDay(start,-1);
  const comparison={state:'unavailable',start:priorStart,end:priorEnd,reason:'Previous seven days are outside the saved source.'};
  if(priorStart>=x.scope.start){
   const prior=apiSnapshot(x,priorStart,priorEnd,hash);
   const observed=s=>s.campaigns.filter(c=>c.metrics);
   const a=observed(current),b=observed(prior);
   const complete=a.length>0&&a.every(c=>c.observed_days===7)&&b.every(c=>c.observed_days===7)&&a.length===b.length&&a.every(c=>b.some(p=>p.campaign_id===c.campaign_id));
   if(complete){
    const spend=spendDifference(current.spend_exact,prior.spend_exact);
    Object.assign(comparison,{state:'comparable_observed_campaigns',reason:null,campaign_ids:a.map(c=>c.campaign_id),observed_campaigns:a.length,mapped_campaigns:x.reports.length,previous_spend_exact:prior.spend_exact,spend_change_exact:spend.exact,spend_change_cents:spend.cents,previous_totals:prior.totals_in_cents_for_spend,changes:Object.fromEntries(Object.keys(fieldMap).map(k=>[k,current.totals_in_cents_for_spend[k]-prior.totals_in_cents_for_spend[k]]))});
   }else comparison.reason='Observed campaign coverage differs or has missing days; no matched complete comparison.';
  }
  current.comparison=comparison;
  const controls=controlWindows.map(c=>[c.start,c.end]).filter(([a,b])=>a>=start&&b<=end);
  current.console_controls_within_window=controls.map(([start,end])=>({start,end}));
  current.quality+=controls.length?' Selected week contains supplied console controls; no independent full-week console control unless the exact week is listed.':' No supplied console control is wholly inside this week; source arithmetic is checked independently, but this week has no external console reconciliation.';
  snapshots.push(current);
 }
 return snapshots;
}
