type Event="token_refresh"|"api_request"|"sync"|"guardrail_failure"|"attribution";
const safe=(value:unknown)=>typeof value==="string"?value.replace(/(Bearer\s+)[^\s]+/gi,"$1[redacted]").replace(/(secret|token|private[_ -]?key)\s*[:=]\s*[^,\s]+/gi,"$1=[redacted]"):value;
export function appleAdsLog(event:Event,fields:Record<string,unknown>={}){console.info(JSON.stringify({scope:"apple_ads",event,at:new Date().toISOString(),...Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,safe(value)]))}));}
