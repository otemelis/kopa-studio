// Freshness describes the retained validated snapshot, never a replacement value for metrics.
export function refreshHealth(manifest, attempt, now = new Date()) {
  const success=Date.parse(manifest.last_successful_refresh_utc);
  const complete=Date.parse(manifest.period_end+'T00:00:00Z');
  const attempted=attempt&&Date.parse(attempt.last_attempt_utc);
  const prefix=`Last complete data date: ${manifest.period_end}. Last successful refresh: ${manifest.last_successful_refresh_utc}. `;
  if(!Number.isFinite(success)||!Number.isFinite(complete))return {status:'unavailable',message:'Snapshot freshness unavailable.'};
  const stale=now-success>86400000 || now-complete>5*86400000;
  let status=stale?'stale':'success';
  let detail=stale?'STALE snapshot. ':'Validated historical snapshot. ';
  if(!attempt||!Number.isFinite(attempted)||!['success','running','failed'].includes(attempt.status)){
    status='unavailable';detail+='Last refresh attempt unavailable.';
  }else{
    detail+=`Last refresh attempt: ${attempt.last_attempt_utc} (${attempt.status}). `;
    if(attempt.status==='failed'){status='failed';detail+='SOURCE REFRESH FAILED; showing the previous validated snapshot.';}
    if(attempt.status==='running'){status='running';detail+='Refresh in progress; showing the previous validated snapshot.';}
  }
  return {status,message:prefix+detail};
}

// Provider instance availability is metadata, never a validated metric or coverage claim.
export function analyticsInstanceAvailability(instances){
 if(!Array.isArray(instances))throw Error('Invalid report instance list');
 const ids=new Set(),dates=[];
 for(const instance of instances){
  const day=instance?.attributes?.processingDate;
  if(typeof instance?.id!=='string'||!instance.id||ids.has(instance.id)||!/^\d{4}-\d{2}-\d{2}$/.test(day??'')||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw Error('Invalid or duplicate report instance');
  ids.add(instance.id);dates.push(day);
 }
 return {state:instances.length?'available_pending_validation':'awaiting_generation',instances:instances.length,latestProcessingDate:dates.sort().at(-1)??null};
}
