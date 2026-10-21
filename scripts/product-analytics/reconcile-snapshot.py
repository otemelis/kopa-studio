import json,datetime,urllib.request,sys
from pathlib import Path
if len(sys.argv)!=3: raise SystemExit('Usage: reconcile-snapshot.py /private/retained-source.json /output/validation.json')
events=json.loads(Path(sys.argv[1]).read_text())['events']
def dt(x):return datetime.datetime.fromisoformat(x.replace('Z','+00:00'))
a=dt('2026-09-17T00:00:00Z');b=dt('2026-10-15T00:00:00Z');all_tf=[x for x in events if x['build_channel']=='testflight'];period=[x for x in all_tf if a<=dt(x['occurred_at'])<b]
with urllib.request.urlopen('http://127.0.0.1:4340/api/product?app=pois&environment=testflight&days=28') as r:live=json.load(r)
assert live['start']==a.isoformat(timespec='milliseconds').replace('+00:00','Z');assert len(period)==324
unique=lambda rows:len({x['installation_id'] for x in rows})
by=lambda name:[x for x in period if x['event_name']==name]
expected={'active':unique(period),'firstOpen':unique([x for x in by('app_opened') if x['properties'].get('first_launch') is True]),'onboarding':unique(by('onboarding_completed')),'activation':unique(by('session_started')),'paywall':unique(by('paywall_viewed')),'trial':unique([x for x in by('purchase_completed') if x['properties'].get('is_trial') is True]),'nonTrial':0,'purchaseUnknown':0}
assert live['metrics']==expected
for r in live['daily']:assert r['value']==unique([x for x in period if dt(x['occurred_at']).date().isoformat()==r['day']])
starts={}
for x in by('session_started'):
 if x['session_id']:starts.setdefault((x['installation_id'],x['session_id']),x)
ends=[]
for key,s in starts.items():
 matches=sorted([e for e in by('session_ended') if (e['installation_id'],e['session_id'])==key and dt(e['occurred_at'])>=dt(s['occurred_at'])],key=lambda e:e['occurred_at'])
 if matches:ends.append(matches[0])
assert live['usage']=={'started':len(starts),'matched_completed':len(ends),'tracked_seconds':sum(e['properties']['tracked_seconds'] for e in ends)}
cohorts={}
for x in all_tf:
 if x['event_name']=='app_opened' and x['properties'].get('first_launch') is True:cohorts[x['installation_id']]=min(cohorts.get(x['installation_id'],dt(x['occurred_at'])),dt(x['occurred_at']))
for day in [1,7]:
 eligible={i:t for i,t in cohorts.items() if a<=t<b and t.date()+datetime.timedelta(days=day+1)<=b.date()}
 returned=sum(any(e['installation_id']==i and e['event_name'] in ['app_opened','app_foregrounded','session_started'] and dt(e['occurred_at']).date()==t.date()+datetime.timedelta(days=day) for e in all_tf) for i,t in eligible.items())
 assert live['retention']['d'+str(day)]['numerator']==returned;assert live['retention']['d'+str(day)]['denominator']==len(eligible)
funnel=[]
for i in {x['installation_id'] for x in by('onboarding_started')}:
 entry=min(dt(x['occurred_at']) for x in by('onboarding_started') if x['installation_id']==i)
 if entry+datetime.timedelta(hours=24)>b:continue
 row=[entry];last=entry;sid=None
 for name in ['onboarding_completed','session_started','session_ended','paywall_viewed','purchase_completed']:
  candidates=[e for e in all_tf if e['installation_id']==i and e['event_name']==name and last is not None and last<=dt(e['occurred_at'])<=entry+datetime.timedelta(hours=24) and (name!='session_started' or e['properties'].get('session_number')==1) and (name!='session_ended' or sid is not None and e['session_id']==sid)]
  e=min(candidates,key=lambda x:dt(x['occurred_at'])) if candidates else None
  if name=='session_started':sid=e['session_id'] if e else None
  last=dt(e['occurred_at']) if e else None;row.append(last)
 funnel.append(row)
assert [live['funnel'][k] for k in ['eligible','completed','started','finished','paywall','purchase']]==[sum(r[n] is not None for r in funnel) for n in range(6)]
output={'validation':'PASS','method':'Independent Python iteration over retained read-only source snapshot, compared to live restricted SQL API; no fixture data used','period':{'start':str(a),'end_exclusive':str(b)},'events':len(period),'metrics':expected,'funnel':live['funnel'],'retention':live['retention'],'usage':live['usage'],'daily_values_checked':len(live['daily']),'checked_at':live['checkedAt']}
Path(sys.argv[2]).write_text(json.dumps(output,indent=2));print(json.dumps(output,indent=2))
