// Source-specific export; no persistence or inferred missing-day zeros.
export type ExportScope={start:string;end:string;days:number;timezone:'UTC'};
export function exportScope(start:string|null,end:string|null,now=new Date()):ExportScope{
 const midnight=new Date(now);midnight.setUTCHours(0,0,0,0);const first=new Date(+midnight-28*86400000).toISOString().slice(0,10),last=new Date(+midnight-86400000).toISOString().slice(0,10),s=start??first,e=end??last;
 for(const d of[s,e])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Invalid UTC date');
 const days=(Date.parse(e)-Date.parse(s))/86400000+1;if(days<1||days>28||e>=midnight.toISOString().slice(0,10)||s<first)throw Error('Use 1–28 complete UTC days within last 28 days');return{start:s,end:e,days,timezone:'UTC'};
}
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid structure');return v as Record<string,unknown>;}
function count(v:unknown):number{if((typeof v!=='number'&&typeof v!=='string')||!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v)))throw Error('Invalid source count');return Number(v);}
export function validateCampaignExport(raw:Record<string,unknown>,campaignId:string,scope:ExportScope){
 const data=object(raw.data??raw),report=object(data.reportingDataResponse),rows=report.row;if(!Array.isArray(rows)||rows.length>1)throw Error('Invalid campaign row count');const pagination=raw.pagination??data.pagination;if(pagination&&Number(object(pagination).totalResults)>1)throw Error('Truncated campaign report');
 const output:Array<Record<string,unknown>>=[],seen=new Set<string>();
 for(const value of rows){const row=object(value);if(String(object(row.metadata).campaignId)!==campaignId||!Array.isArray(row.granularity))throw Error('Campaign/daily grain mismatch');
 for(const value of row.granularity){const day=object(value),date=day.date;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<scope.start||date>scope.end||seen.has(date))throw Error('Duplicate or out-of-window date');seen.add(date);const t=object(day.total??day),money=object(t.localSpend);if(typeof money.amount!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(money.amount)||typeof money.currency!=='string'||! /^[A-Z]{3}$/.test(money.currency))throw Error('Money/currency unavailable');
 const tap=count(t.tapInstalls),view=count(t.viewInstalls),total=count(t.totalInstalls),fresh=count(t.totalNewDownloads),repeat=count(t.totalRedownloads);if(tap+view!==total||fresh+repeat!==total)throw Error('Attribution components mismatch');output.push({date,campaignId,impressions:count(t.impressions),taps:count(t.taps),spend:money.amount,currency:money.currency,tapInstalls:tap,viewInstalls:view,totalInstalls:total,newDownloads:fresh,redownloads:repeat});}}
 return{campaignId,status:output.length?'observed':'no_reported_rows',rows:output,missingDays:scope.days-seen.size,note:'Provider omits no-metric rows; absent dates remain unobserved, not zero.'};
}
