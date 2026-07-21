export type Freshness="fresh"|"stale"|"missing";
export function freshness(lastSyncAt:string|null,now:string,maxAgeHours=24):Freshness{if(!lastSyncAt)return "missing";return Date.parse(now)-Date.parse(lastSyncAt)<=maxAgeHours*36e5?"fresh":"stale";}
export function writesEligible(input:{freshness:Freshness;partial:boolean;currencyKnown:boolean}){return input.freshness==="fresh"&&!input.partial&&input.currencyKnown;}
