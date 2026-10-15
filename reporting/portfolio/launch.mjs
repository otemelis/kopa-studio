import{aggregate,period}from'./model.mjs';import{productCell,productionTrend}from'./launch-model.mjs';
let generation=0;
function el(tag,text,parent){const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;}
function apple(snapshot,app,metric,w){const v=aggregate(snapshot,app,metric,w.start,w.end);return v.state==='available'?v.amounts.map(a=>a.currency?`${a.currency} ${a.value/100}`:String(a.value)).join(' · '):'Unavailable';}
export async function renderLaunch(snapshot,days){
 const token=++generation,w=snapshot?period(snapshot,days):null,body=document.querySelector('#launch-rows');body.replaceChildren();
 for(const app of['InnerType','LoveType','POIS','PASSPORT']){
 const row=el('tr','',body);el('th',app,row).scope='row';const official=el('td','',row);
 if(['InnerType','LoveType'].includes(app)&&snapshot){el('strong',`${apple(snapshot,app,'first_time_app_units_sales',w)} downloads · ${apple(snapshot,app,'apple_reported_paid_iap_units_sales',w)} paid IAP units`,official);el('p',`${w.start}–${w.end} · Apple Sales, Pacific dates · historical CSV`,official);}else{el('strong','Unavailable',official);el('p','No validated official Apple report available in this page’s source.',official);}
 const prod=el('td','Reading private source…',row),tf=el('td','Reading private source…',row);
 if(['InnerType','LoveType'].includes(app)){prod.textContent='Not integrated';tf.textContent='Not integrated';continue;}
 const name=app.toLowerCase();
 for(const[environment,cell]of[['appstore',prod],['testflight',tf]]){
 // Each source/environment succeeds or fails independently of the Apple snapshot and other rows.
 fetch('/api/product?'+new URLSearchParams({app:name,environment,days}),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>null).then(result=>{
 if(token!==generation)return;const summary=productCell(result);cell.replaceChildren();el('strong',summary.value,cell);el('p',summary.note,cell);
 if(result)el('p',`${result.start.slice(0,10)}–${new Date(Date.parse(result.end)-86400000).toISOString().slice(0,10)} · ${name==='pois'?'UTC events':'device-local aggregate dates'} · latest receipt ${result.coverage.latest_received??'unavailable'} · checked ${result.checkedAt}`,cell);
 if(environment==='appstore')el('p',productionTrend(result),cell);
 const a=el('a','Open Product Analytics',cell);a.href='product.html?'+new URLSearchParams({app:name,environment,days});
 });
 }
 }
}
