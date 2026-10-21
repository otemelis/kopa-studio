// Product observations and Apple units remain independent; never calculate a cross-source funnel.
export function productCell(result){
 if(!result)return {value:'Unavailable',note:'Source query failed; no replacement data.'};
 if(result.status==='production_not_observed')return {value:'Production not yet observed',note:'No App Store-tagged telemetry; TestFlight is separate.'};
 if(result.status==='no_data_yet')return {value:'No data yet',note:'No source rows in this environment.'};
 if(!result.metrics)return {value:'Installation metrics unavailable',note:'Anonymous aggregates; no installation identities. '+(result.quality??'')};
 return {value:`${result.metrics.firstOpen} first launches · ${result.metrics.activation} activated`,note:`${result.metrics.active} active installations · ${result.metrics.paywall} paywall · ${result.metrics.trial} client trial completions · latest event ${result.coverage.latest_event??'unavailable'} · read ${result.checkedAt}`};
}
export function productionTrend(result){
 if(!result||result.status!=='observed')return 'Launch trend unavailable until App Store production telemetry is observed. No launch date inferred from TestFlight.';
 return 'Complete UTC reporting window; release date is not inferred. Use Product Analytics for daily activity. Small samples do not trigger automated alerts.';
}
