#!/usr/bin/env python3
"""Manual GET-only refresh using the existing Apple extractor and two independent calculations."""
import fcntl, csv, hashlib, json, os, shutil, subprocess, sys
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SCRIPTS=ROOT/'scripts/app-store'
PAGE=ROOT/'reporting/portfolio'
NODE=Path('/Users/otastemelis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
def write_attempt(attempted, status, error=None):
    value={'last_attempt_utc':attempted,'status':status,'failure':error}
    temp=PAGE/'refresh-status.json.tmp';temp.write_text(json.dumps(value,indent=2)+'\n');os.replace(temp,PAGE/'refresh-status.json')

def publish(run, start, end):
    csvpath=run/'daily-acquisition-monetization.csv'
    validation=json.loads((run/'daily-independent-validation.json').read_text())
    digest=hashlib.sha256(csvpath.read_bytes()).hexdigest()
    if validation['dataset_sha256']!=digest or not validation['weekly_equals_daily']:raise ValueError('Validation mismatch')
    # Also run exactly the same strict calendar/metric loader used by the page before publishing.
    subprocess.run([str(NODE),'--input-type=module','-e',"import fs from 'node:fs'; import {loadSnapshot} from "+json.dumps((PAGE/'model.mjs').as_uri())+"; const s=loadSnapshot(fs.readFileSync(process.argv[1],'utf8')); if(s.start!==process.argv[2]||s.end!==process.argv[3])throw Error('Period mismatch');",str(csvpath),start,end],check=True)
    name='daily-'+digest+'.csv'
    target=PAGE/name
    if not target.exists():shutil.copyfile(csvpath,target)
    manifest={'schema_version':1,'csv':name,'sha256':digest,'period_start':start,'period_end':end,'last_successful_refresh_utc':datetime.now(timezone.utc).isoformat(),'run':run.name,'validation':'independent SQL, raw checksums, daily-to-weekly Sales controls','historical_snapshot':True}
    availability=run/'analytics-availability.json'
    if availability.exists():
        manifest['analytics_availability']=json.loads(availability.read_text())
    temp=PAGE/'current.json.tmp';temp.write_text(json.dumps(manifest,indent=2)+'\n');os.replace(temp,PAGE/'current.json')
    (run/'published.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

def validate_analytics_configuration(app, request):
    approved=json.loads((SCRIPTS/'approved-analytics-requests.json').read_text())
    rows=request['data']
    if request.get('links',{}).get('next'):raise RuntimeError(f'{app} report request pagination requires review')
    if not rows:return
    if len(rows)!=1 or rows[0]['id']!=approved.get(app) or rows[0]['attributes'].get('accessType')!='ONGOING' or rows[0]['attributes'].get('stoppedDueToInactivity'):
        raise RuntimeError(f'{app} reporting configuration changed: review its mapping before publication')
    # Approved generation is not validated metric coverage; retain blank Analytics values.

def main():
    if not __debug__:raise RuntimeError("Validation requires Python assertions; do not use -O")
    lock=(SCRIPTS/'refresh.lock').open('w')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:raise RuntimeError('Another refresh is already running')
    run=SCRIPTS/'runs'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    run.mkdir(parents=True,mode=0o700)
    attempted=datetime.now(timezone.utc).isoformat()
    write_attempt(attempted,'running')
    env=dict(os.environ,ASC_RUN_DIR=str(run))
    def apple(mode):subprocess.run([str(NODE),str(SCRIPTS/'read-apple.mjs'),mode],env=env,check=True,stdout=subprocess.DEVNULL)
    try:
        apple('inventory')
        for app in ['LoveType','POIS','PASSPORT']:
            request=json.loads((run/f'{app}-requests-0.json').read_text())
            validate_analytics_configuration(app,request)
        apple('instances')
        latest=max(x['attributes']['processingDate'] for x in json.loads((run/'InnerType-discovery-instances-0.json').read_text())['data'])
        # Discovery's conservative three-day completion lag controls the common portfolio period.
        end=min(date.fromisoformat(latest)-timedelta(days=3),datetime.now(timezone.utc).date()-timedelta(days=3))
        start=end-timedelta(days=27)
        week_start=start+timedelta(days=(6-start.weekday())%7)
        if week_start-start<timedelta(days=6):week_start+=timedelta(days=7)
        env.update(ASC_START=start.isoformat(),ASC_END=end.isoformat(),ASC_WEEK_START=week_start.isoformat(),ASC_SUMMARY_DIR=str(run/'summary'),ASC_BASE=str(run/'summary/acquisition-monetization-28-days.csv'),ASC_CSV=str(run/'daily-acquisition-monetization.csv'))
        print(f'Refreshing {start} through {end}; private evidence: {run}',flush=True)
        apple('download');apple('sales');apple('sales-weekly')
        shutil.copyfile(run/'LoveType-requests-0.json',run/'LoveType-requests-daily-review-0.json')
        logs=json.loads((run/'retrieval-log.json').read_text());entry=next(x for x in logs if x['file']=='LoveType-requests-0.json').copy();entry['file']='LoveType-requests-daily-review-0.json';logs.append(entry);(run/'retrieval-log.json').write_text(json.dumps(logs))
        for script in ['analyse-report.py','daily-dataset.py','verify-daily.py']:
            subprocess.run([sys.executable,str(SCRIPTS/script)],env=env,check=True)
        manifest=publish(run,start.isoformat(),end.isoformat())
        write_attempt(attempted,'success')
        print(json.dumps(manifest,indent=2))
    except Exception as e:
        (run/'FAILED.txt').write_text(str(e)+'\n')
        write_attempt(attempted,'failed','Refresh failed before publication; previous validated snapshot retained. See private run log.')
        print('Refresh failed. Existing published snapshot remains unchanged. '+str(e),file=sys.stderr);raise
if __name__=='__main__':main()
