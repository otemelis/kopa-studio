"""Independent Decimal/csv control for the saved JSON and JS-generated daily CSV."""
import csv, hashlib, io, json, sys
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
source, *controls = sys.argv[1:]
x=json.load(open(source)); rows=[r for c in x['reports'] for r in c['rows']]
assert len({(r['campaignId'],r['date']) for r in rows})==len(rows)
fields={'Impressions':'impressions','Taps':'taps','Installs (Tap-Through)':'tapInstalls','Installs (View-Through)':'viewInstalls','Installs (Total)':'totalInstalls','New Downloads (Total)':'newDownloads','Redownloads (Total)':'redownloads'}
checks=[]
for file in controls:
 text=open(file,encoding='utf-8-sig').read();lines=text.splitlines();header=next(i for i,v in enumerate(lines) if v.startswith('Campaign ID,'));meta={}
 for line in lines[:header]:
  line=line.strip('"')
  if ': ' in line:
   k,v=line.split(': ',1);meta[k]=v
 start=datetime.strptime(meta['Start Date'],'%d.%m.%Y').strftime('%Y-%m-%d');end=datetime.strptime(meta['End Date'],'%d.%m.%Y').strftime('%Y-%m-%d');assert meta['Currency']=='EUR' and meta['Time Zone']=='UTC'
 csvrows=list(csv.DictReader(lines[header:]));footer=[r for r in csvrows if not r['Campaign ID']];assert len(footer)==1; campaigns=[r for r in csvrows if r['Campaign ID']]
 assert {r['Campaign ID'] for r in campaigns}=={c['campaignId'] for c in x['reports']}
 subset=[r for r in rows if start<=r['date']<=end]
 for k,f in fields.items():assert sum(r[f] for r in subset)==int(footer[0][k])==sum(int(r[k]) for r in campaigns),(k,start)
 exact=sum((Decimal(r['spend']) for r in subset),Decimal(0));assert exact.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)==Decimal(footer[0]['Spend'])
 for c in campaigns:
  a=[r for r in subset if r['campaignId']==c['Campaign ID']]
  if a:
   for k,f in fields.items():assert sum(r[f] for r in a)==int(c[k])
   assert sum((Decimal(r['spend']) for r in a),Decimal(0)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)==Decimal(c['Spend'])
 checks.append({'start':start,'end':end,'exactApiSpend':str(exact),'consoleSpend':footer[0]['Spend'],'result':'PASS; absent API campaigns remain unavailable'})
published=list(csv.DictReader(open('docs/milestones/m6/apple-ads-daily.csv')));assert len(published)==84
observed=[r for r in published if r['data_quality_status'].startswith('observed')];missing=[r for r in published if r['data_quality_status'].startswith('unavailable')];assert len(observed)==len(rows)==28 and len(missing)==56
lookup={(r['campaignId'],r['date']):r for r in rows}
for row in observed:
 original=lookup[(row['campaign_id'],row['date'])];assert row['spend']==original['spend']
 for f in fields.values():assert int(row[f])==original[f]
for r in missing:
 assert all(r[f]=='' for f in [*fields.values(),'spend','currency'])
snapshot=json.load(open('reporting/portfolio/apple-ads-snapshot.json'))
for s in snapshot['snapshots']:
 if s.get('source_kind')!='api_export':continue
 subset=[r for r in rows if s['period_start']<=r['date']<=s['period_end']]
 assert s['spend_exact']==str(sum((Decimal(r['spend']) for r in subset),Decimal(0)))
 for k,f in fields.items():assert s['totals_in_cents_for_spend'][k]==sum(r[f] for r in subset)
 for c in s['campaigns']:
  a=[r for r in subset if r['campaignId']==c['campaign_id']]
  if not a:assert c['metrics'] is None and c['spend_exact'] is None
  else:
   exact=sum((Decimal(r['spend']) for r in a),Decimal(0));assert c['metrics']['Spend']==int(exact.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)*100)
   installs=sum(r['totalInstalls'] for r in a);expected=int((exact/installs).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)*100) if installs else None
   assert c['cpa_cents']==expected
# Independently control weekly matched-coverage comparisons from original daily rows.
weekly=[s for s in snapshot['snapshots'] if s.get('window_kind')=='seven_complete_days']
assert len(weekly)==x['scope']['days']//7
for s in weekly:
 start=datetime.fromisoformat(s['period_start']);end=datetime.fromisoformat(s['period_end']);assert (end-start).days==6
 p=s['comparison'];assert p['start']==(start-timedelta(days=7)).date().isoformat() and p['end']==(start-timedelta(days=1)).date().isoformat()
 expected_controls=[{'start':c['start'],'end':c['end']} for c in checks if c['start']>=s['period_start'] and c['end']<=s['period_end']]
 assert sorted(s['console_controls_within_window'],key=lambda c:(c['start'],c['end']))==sorted(expected_controls,key=lambda c:(c['start'],c['end']))
 if p['start']<x['scope']['start']:
  assert p['state']=='unavailable';continue
 a=[r for r in rows if s['period_start']<=r['date']<=s['period_end']];b=[r for r in rows if p['start']<=r['date']<=p['end']]
 aid={r['campaignId'] for r in a};bid={r['campaignId'] for r in b}
 adates={(start+timedelta(days=i)).date().isoformat() for i in range(7)};bdates={(start-timedelta(days=7)+timedelta(days=i)).date().isoformat() for i in range(7)}
 comparable=bool(aid) and aid==bid and all({r['date'] for r in a if r['campaignId']==cid}==adates and {r['date'] for r in b if r['campaignId']==cid}==bdates for cid in aid)
 assert (p['state']=='comparable_observed_campaigns')==comparable
 if comparable:
  current=sum((Decimal(r['spend']) for r in a),Decimal(0));previous=sum((Decimal(r['spend']) for r in b),Decimal(0));delta=current-previous
  assert Decimal(p['previous_spend_exact'])==previous and Decimal(p['spend_change_exact'])==delta
  assert p['spend_change_cents']==int(delta.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)*100)
  assert set(p['campaign_ids'])==aid and p['observed_campaigns']==len(aid) and p['mapped_campaigns']==len(x['reports'])
  for key,field in fields.items():assert p['changes'][key]==sum(r[field] for r in a)-sum(r[field] for r in b) and p['previous_totals'][key]==sum(r[field] for r in b)
result={'validator':'independent Python csv + Decimal','result':'PASS','coverage':{'observedRows':len(observed),'unavailableCoverageRows':len(missing)},'observedTotals':{f:sum(r[f] for r in rows) for f in fields.values()},'spendExact':str(sum((Decimal(r['spend']) for r in rows),Decimal(0))),'controls':checks,'sourceSha256':hashlib.sha256(open(source,'rb').read()).hexdigest(),'snapshotApiWindowsChecked':sum(s.get('source_kind')=='api_export' for s in snapshot['snapshots']),'weeklyComparisonsChecked':len(weekly)}
print(json.dumps(result,indent=2))
