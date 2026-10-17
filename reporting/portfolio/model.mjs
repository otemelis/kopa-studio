// Read-only calculations over the single accepted historical CSV. Money stays in integer cents.
export const SOURCE_SHA256 = '4c2f5f06e45bd37eccc195f26eb67d89176d25ea58e40fd5c92b4a42c8b19bd8';
export async function verifySource(bytes, expected=SOURCE_SHA256){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw Error('Snapshot integrity check failed');
}
export const APPS = ['InnerType', 'LoveType'];
export const METRICS = [
  { key:'first_time_app_units_sales', label:'First-time downloads', note:'Apple-account app units · Pacific dates', unit:'count' },
  { key:'icon_impressions', label:'Impressions', note:'Icon impressions only · excludes page views · UTC', unit:'count' },
  { key:'product_page_views', label:'Product-page views', note:'Product-page view events · UTC', unit:'count' },
  { key:'apple_reported_paid_iap_units_sales', label:'Paid purchases', note:'Apple-reported IAP units · Pacific dates', unit:'count' },
  { key:'estimated_proceeds_native_currency', label:'Estimated proceeds', note:'Native currencies · Pacific dates · not settled payments', unit:'money' },
];
export const shift = (d,n) => new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const daysBetween = (start,end) => Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
export function parseCSV(text) {
  text=text.replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted&&text[i+1]==='"'){field+='"';i++;} else if(!quoted&&field!=='') throw Error('Invalid CSV quote'); else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(field!==''||row.length){row.push(field);rows.push(row);}
  const header=rows.shift();
  if(!header||new Set(header).size!==header.length)throw Error('Invalid CSV header');
  return rows.map(values=>{if(values.length!==header.length)throw Error('Invalid CSV row');return Object.fromEntries(header.map((h,i)=>[h,values[i]]));});
}
export function integer(value,money=false) {
  if(!/^-?\d+(?:\.\d+)?$/.test(value))throw Error('Invalid numeric value');
  const [whole,decimal='']=value.split('.');
  if(money&&decimal.length>2)throw Error('Unsupported money precision');
  if(!money&&decimal&&!/^0+$/.test(decimal))throw Error('Fractional event count');
  const result=money?Number(whole)*100+(value.startsWith('-')?-1:1)*Number(decimal.padEnd(2,'0')):Number(value);
  if(!Number.isSafeInteger(result))throw Error('Unsafe value');
  return result;
}
const goodStatuses=new Set(['reported_value','zero_matching_rows','zero_apple_no_sales','zero_no_matching_sales_rows','zero_no_rows_in_validated_standard_extract','derived_event_ratio','undefined_zero_denominator','unavailable_no_analytics_request','unavailable_source_capability']);
export function loadSnapshot(text) {
  const all=parseCSV(text);
  if(!all.length)throw Error('Unexpected snapshot row count');
  const keys=new Set();
  for(const row of all){
    const key=[row.date,row.app,row.metric,row.acquisition_source,row.currency].join('|');
    if(keys.has(key)||![...APPS,'POIS','PASSPORT'].includes(row.app)||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!goodStatuses.has(row.data_quality_status))throw Error('Invalid snapshot coverage');
    keys.add(key);
    if(row.data_quality_status.startsWith('unavailable')||row.data_quality_status==='undefined_zero_denominator'){
      if(row.value!=='')throw Error('Unavailable metric must be blank');
    }else if(row.value==='')throw Error('Available metric is blank');
  }
  for(const key of new Set(all.map(r=>[r.app,r.metric,r.acquisition_source,r.currency].join('|')))){if(all.filter(r=>[r.app,r.metric,r.acquisition_source,r.currency].join('|')===key).length!==28)throw Error('Partial source series');}
  const rows=all.filter(r=>r.scope==='summary'&&METRICS.some(m=>m.key===r.metric));
  const dates=[...new Set(all.map(r=>r.date))].sort();
  if(dates.length!==28||daysBetween(dates[0],dates.at(-1))!==28)throw Error('Incomplete date calendar');
  const apps=[...new Set(all.map(r=>r.app))];
  if(APPS.some(app=>!apps.includes(app)))throw Error('Missing baseline app');
  for(const app of apps)for(const metric of METRICS){
    const rs=rows.filter(r=>r.app===app&&r.metric===metric.key);
    if(!rs.length)throw Error('Missing portfolio series');
    for(const currency of new Set(rs.map(r=>r.currency))){
      const series=rs.filter(r=>r.currency===currency);
      if(series.length!==28||dates.some(d=>!series.some(r=>r.date===d)))throw Error('Partial portfolio series');
      for(const r of series){
        if(r.value!=='')integer(r.value,metric.unit==='money');
        if(metric.unit==='count'&&r.currency!=='')throw Error('Currency on event count');
        const timezone=metric.key==='icon_impressions'||metric.key==='product_page_views'?'UTC':'America/Los_Angeles (downloaded Sales report dates)';
        if(r.source_timezone!==timezone)throw Error('Mixed reporting timezone');
      }
    }
  }
  return {rows,dates,apps,start:dates[0],end:dates.at(-1),extracted:all.map(r=>r.source_extracted_at_utc).sort().at(-1).slice(0,10)};
}
export function aggregate(snapshot,app,metric,start,end) {
  if(start<snapshot.start||end>snapshot.end)return {state:'outside',reason:'Previous period is outside the CSV snapshot.'};
  const definition=METRICS.find(m=>m.key===metric);
  const rows=snapshot.rows.filter(r=>r.app===app&&r.metric===metric&&r.date>=start&&r.date<=end);
  if(!rows.length||rows.some(r=>r.value===''))return {state:'unavailable',reason:'Analytics reporting is not available in this CSV.'};
  const amounts=[];
  for(const currency of [...new Set(rows.map(r=>r.currency))].sort()){
    const rs=rows.filter(r=>r.currency===currency);
    if(rs.length!==daysBetween(start,end))return {state:'unavailable',reason:'The CSV does not contain a complete series.'};
    amounts.push({currency,value:rs.reduce((sum,r)=>sum+integer(r.value,definition.unit==='money'),0)});
  }
  return {state:'available',amounts};
}
export function period(snapshot,days=28) {
  if(days!==7&&days!==28)throw Error('Unsupported period');
  const end=snapshot.end,start=shift(end,1-days),previous={start:shift(start,-days),end:shift(start,-1)};
  const weeks=[];
  if(days===7)weeks.push({...previous,label:'Previous week',previous:true});
  for(let d=start;d<=end;d=shift(d,7))weeks.push({start:d,end:shift(d,6),label:'Selected week',previous:false});
  return {days,start,end,previous,comparable:previous.start>=snapshot.start,weeks};
}
export function difference(current,previous){
  if(current.state!=='available'||previous.state!=='available')return null;
  if(current.amounts.map(x=>x.currency).join('|')!==previous.amounts.map(x=>x.currency).join('|'))return null;
  return current.amounts.map((x,i)=>({currency:x.currency,value:x.value-previous.amounts[i].value}));
}
