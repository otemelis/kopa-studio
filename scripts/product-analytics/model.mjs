export function scope(app,environment,days,now=new Date()) {
 if(!['pois','passport'].includes(app)||!['testflight','appstore'].includes(environment)||![7,28].includes(Number(days))) throw new Error('Invalid app, environment or period');
 const end=new Date(now);end.setUTCHours(0,0,0,0);const start=new Date(end);start.setUTCDate(start.getUTCDate()-Number(days));return {app,environment,days:Number(days),start:start.toISOString(),end:end.toISOString()};
}
export function ratio(n,d){return d>0?{numerator:n,denominator:d,percent:100*n/d,status:'observed'}:{numerator:n,denominator:d,percent:null,status:'unavailable'};}
export function fillDays(s,rows){const map=new Map(rows.map(r=>[r.day,r.value]));return Array.from({length:s.days},(_,i)=>{const d=new Date(s.start);d.setUTCDate(d.getUTCDate()+i);const day=d.toISOString().slice(0,10);return{day,value:map.get(day)??0};});}
