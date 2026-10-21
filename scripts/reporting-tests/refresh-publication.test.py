"""Offline publication failure regression; never calls Apple."""
import importlib.util,json,tempfile,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('refresh',R/'scripts/app-store/refresh.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as td:
 root=Path(td);m.PAGE=root/'page';m.PAGE.mkdir();run=root/'run';run.mkdir()
 good=b'{"previous_validated_snapshot":true}';(m.PAGE/'current.json').write_bytes(good)
 (run/'daily-acquisition-monetization.csv').write_bytes(b'corrupted')
 (run/'daily-independent-validation.json').write_text(json.dumps({'dataset_sha256':'0'*64,'weekly_equals_daily':True}))
 m.write_attempt('2026-10-15T14:00:00Z','running')
 try:m.publish(run,'2026-09-14','2026-10-11')
 except ValueError:m.write_attempt('2026-10-15T14:00:00Z','failed','Verification rejected staged CSV')
 else:raise AssertionError('Corrupted staged CSV published')
 assert (m.PAGE/'current.json').read_bytes()==good
 a=json.loads((m.PAGE/'refresh-status.json').read_text());assert a['status']=='failed' and a['last_attempt_utc']=='2026-10-15T14:00:00Z'
print('PASS: corrupted publication rejected, last-good manifest unchanged, failed attempt recorded')

approved=json.loads((m.SCRIPTS/'approved-analytics-requests.json').read_text())
for app,request_id in approved.items():
 body={'data':[{'id':request_id,'attributes':{'accessType':'ONGOING','stoppedDueToInactivity':False}}],'links':{}}
 m.validate_analytics_configuration(app,body)
 for bad in [
  {'data':[{'id':'unapproved','attributes':{'accessType':'ONGOING'}}]},
  {'data':[{'id':request_id,'attributes':{'accessType':'ONE_TIME_SNAPSHOT'}}]},
  {'data':[{'id':request_id,'attributes':{'accessType':'ONGOING','stoppedDueToInactivity':True}}]},
  {**body,'links':{'next':'unexpected-page'}},
  {'data':body['data']*2},
 ]:
  try:m.validate_analytics_configuration(app,bad)
  except RuntimeError:pass
  else:raise AssertionError('Unapproved report configuration accepted')
print('PASS: only the approved active ongoing requests are accepted; duplicates, inactivity, historical type and pagination fail closed')

# A failed optional Analytics availability check must not fabricate zero or block verified Sales.
with tempfile.TemporaryDirectory() as td:
 root=Path(td);m.PAGE=root/'page';m.PAGE.mkdir();run=root/'run';run.mkdir()
 (m.PAGE/'model.mjs').write_bytes((R/'reporting/portfolio/model.mjs').read_bytes())
 current=json.loads((R/'reporting/portfolio/current.json').read_text())
 source=(R/'reporting/portfolio'/current['csv']).read_bytes()
 (run/'daily-acquisition-monetization.csv').write_bytes(source)
 (run/'daily-independent-validation.json').write_text(json.dumps({'dataset_sha256':hashlib.sha256(source).hexdigest(),'weekly_equals_daily':True}))
 availability=[{'app':app,'reports':[{'kind':kind,'state':'query_failed','instances':None} for kind in ['discovery','downloads','purchases']]} for app in ['POIS','PASSPORT','LoveType']]
 (run/'analytics-availability.json').write_text(json.dumps(availability))
 manifest=m.publish(run,current['period_start'],current['period_end'])
 assert manifest['analytics_availability']==availability
 assert (m.PAGE/manifest['csv']).read_bytes()==source
 assert all(report['instances'] is None for app in manifest['analytics_availability'] for report in app['reports'])
print('PASS: failed optional Analytics checks preserve verified Sales bytes and explicit null availability')
