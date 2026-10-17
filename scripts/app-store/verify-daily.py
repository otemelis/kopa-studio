import os
"""Independent SQL reconciliation: delivered daily CSV versus original Apple TSVs and weekly controls."""
import csv, hashlib, json, sqlite3
from datetime import datetime, timedelta
from decimal import Decimal as D
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]; P=Path(os.environ.get('ASC_RUN_DIR',Path(__file__).parent/'private'))
FILE=Path(os.environ.get('ASC_CSV',ROOT/'outputs/inner-lovetype-daily-dataset/daily-acquisition-monetization.csv'))
BASE=Path(os.environ.get('ASC_BASE',ROOT/'outputs/inner-lovetype-28-day-report/acquisition-monetization-28-days.csv'))
def load(p,delimiter=','):
    with p.open(encoding='utf-8-sig',newline='') as f:return [{k:v.strip() for k,v in r.items()} for r in csv.DictReader(f,delimiter=delimiter)]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cent(s):
    n=D(s)*100;assert n==n.to_integral_value();return int(n)
daily=load(FILE);base=load(BASE)
key=lambda r:(r['app'],r['metric'],r.get('acquisition_source',r.get('source_type')),r['currency'])
assert len(daily)==len(base)*28 and len({(r['date'],*key(r)) for r in daily})==len(daily)
days={(datetime.fromisoformat(os.environ.get('ASC_START','2026-09-14'))+timedelta(days=i)).date().isoformat() for i in range(28)}
assert {r['date'] for r in daily}==days and {key(r) for r in daily}=={key(r) for r in base}
for r in daily:
    files=r['evidence_files'].split(';'); hashes=r['evidence_sha256'].split(';'); assert len(files)==len(hashes)
    assert all(sha(P/f)==h for f,h in zip(files,hashes))
db=sqlite3.connect(':memory:')
db.execute('CREATE TABLE a(d,p,kind,source,event,page,download_type,counts INTEGER,purchases INTEGER,cents INTEGER)')
for m in json.loads((P/'segment-manifest.json').read_text()):
    for r in load(P/m['filename'],'\t'):
        db.execute('INSERT INTO a VALUES (?,?,?,?,?,?,?,?,?,?)',(r['Date'],m['processingDate'],m['kind'],r['Source Type'],r.get('Event',''),r['Page Type'],r.get('Download Type',''),int(r.get('Counts',0)),int(r.get('Purchases',0)),cent(r.get('Proceeds in USD','0'))))
db.execute(f'''CREATE TEMP VIEW chosen AS SELECT * FROM a WHERE (kind,d,p) IN
 (SELECT kind,d,MAX(p) FROM a GROUP BY kind,d) AND d BETWEEN '{min(days)}' AND '{max(days)}' ''')
db.execute('CREATE TABLE s(grain,d,app,pti,currency,country,units INTEGER,cents INTEGER,price_positive INTEGER,is_child INTEGER)')
portfolio=json.loads((Path(__file__).parent/'portfolio-apps.json').read_text())
appmap={sku:(app,identifier) for app,(identifier,sku) in portfolio.items()}
for grain,pattern in [('daily','Sales-????-??-??.tsv'),('weekly','Sales-weekly-*.tsv')]:
    for f in P.glob(pattern):
        for r in load(f,'\t'):
            child=bool(r['Parent Identifier']); identifier=r['Parent Identifier'] if child else r['SKU']
            app,appleid=appmap.get(identifier,('Outside portfolio: '+identifier,None))
            if not child and appleid:assert r['Apple Identifier']==appleid
            units=D(r['Units']);assert units==int(units)
            d=datetime.strptime(r['End Date'],'%m/%d/%Y').date().isoformat()
            db.execute('INSERT INTO s VALUES (?,?,?,?,?,?,?,?,?,?)',(grain,d,app,r['Product Type Identifier'],r['Currency of Proceeds'],r['Country Code'],int(units),cent(units*D(r['Developer Proceeds'])),int(D(r['Customer Price'])>0),int(child)))
# Separate weekly source files independently control every Sales dimension, not just headline totals.
control_days=sorted({(datetime.fromisoformat(m['date'])-timedelta(days=i)).date().isoformat() for m in json.loads((P/'sales-weekly-manifest.json').read_text()) for i in range(7)})
controls=[]
for grain in ['daily','weekly']:
    controls.append(list(db.execute('SELECT app,pti,currency,country,SUM(units),SUM(cents) FROM s WHERE grain=? AND d BETWEEN ? AND ? GROUP BY app,pti,currency,country ORDER BY app,pti,currency,country',(grain,min(control_days),max(control_days)))))
assert controls[0]==controls[1]

additive_queries={
 'icon_impressions':("kind='discovery' AND event='Impression'",'counts'),
 'product_page_views':("kind='discovery' AND event='Page view' AND page='Product page'",'counts'),
 'first_time_downloads':("kind='downloads' AND download_type='First-time download'",'counts'),
 'apple_reported_purchase_units_net':("kind='purchases'",'purchases'),
 'estimated_proceeds_usd':("kind='purchases'",'cents')}
checked=0
for r in daily:
    status=r['data_quality_status']; metric=r['metric']
    if status.startswith('unavailable'):
        assert r['value']=='' and r['numerator']=='' and r['denominator']==''
        if status=='unavailable_no_analytics_request':assert r['app']!='InnerType' and json.loads((P/r['evidence_files']).read_text())['data']==[]
        if status=='unavailable_analytics_pending_validation':
            request=json.loads((P/r['evidence_files']).read_text());approved=json.loads((Path(__file__).parent/'approved-analytics-requests.json').read_text())
            assert len(request['data'])==1 and request['data'][0]['id']==approved[r['app']] and request['data'][0]['attributes']['accessType']=='ONGOING' and not request['data'][0]['attributes']['stoppedDueToInactivity']
        continue
    if r['source'].startswith('Summary Sales'):
        where='grain=\'daily\' AND app=? AND d=?';args=[r['app'],r['date']]
        if metric=='first_time_app_units_sales':where+=" AND pti='1' AND is_child=0";col='units'
        elif metric=='apple_reported_paid_iap_units_sales':where+=" AND pti='IA1' AND is_child=1 AND price_positive=1 AND units>0";col='units'
        else:where+=' AND currency=?';args.append(r['currency']);col='cents'
        expected=db.execute(f'SELECT COALESCE(SUM({col}),0) FROM s WHERE {where}',args).fetchone()[0]
        if col=='cents':expected=D(expected)/100
        assert D(r['value'])==expected,(r,expected)
    else:
        source_clause='' if r['acquisition_source']=='All sources' else ' AND source=?'
        args=[r['date']]+([] if not source_clause else [r['acquisition_source']])
        if metric=='product_page_first_downloads_per_view':
            components=[]
            for condition in ["kind='downloads' AND download_type='First-time download' AND page='Product page'","kind='discovery' AND event='Page view' AND page='Product page'"]:
                components.append(db.execute('SELECT COALESCE(SUM(counts),0) FROM chosen WHERE d=?'+source_clause+' AND '+condition,args).fetchone()[0])
            n,d=components;assert int(r['numerator'])==n and int(r['denominator'])==d
            assert r['value']==(f'{D(n)*100/D(d):.6f}' if d else '')
            assert (status=='undefined_zero_denominator')==(d==0)
        else:
            condition,col=additive_queries[metric]
            expected=db.execute(f'SELECT COALESCE(SUM({col}),0) FROM chosen WHERE d=?'+source_clause+' AND '+condition,args).fetchone()[0]
            if col=='cents':expected=D(expected)/100
            assert D(r['value'])==expected,(r,expected)
    checked+=1

results=[]
for b in base:
    rs=[r for r in daily if key(r)==key(b)];assert len(rs)==28 and {r['date'] for r in rs}==days
    if b['status']=='unavailable':
        assert all(r['value']=='' for r in rs);actual='';method='unavailable preserved'
    elif b['unit']=='percent of event counts':
        n=sum(int(r['numerator']) for r in rs);d=sum(int(r['denominator']) for r in rs)
        actual=f'{D(n)*100/D(d):.6f}' if d else '';method='ratio of summed components' if d else 'undefined preserved'
    else:
        actual=str(sum((D(r['value']) for r in rs),D(0)));method='sum'
    assert actual==b['value'] if actual=='' else D(actual)==D(b['value'])
    results.append({'app':b['app'],'metric':b['metric'],'acquisition_source':b['source_type'],'currency':b['currency'],'baseline':b['value'],'daily_aggregate':actual,'method':method,'match':True})

# Deliberate failure probes do not alter any source or delivered file.
assert len({(r['date'],*key(r)) for r in daily+[daily[0]]})!=len(daily)+1
assert len([r for r in daily[1:] if key(r)==key(daily[0])])==27
zero=[r for r in daily if r['data_quality_status']=='zero_apple_no_sales'];assert all(r['value'] in ['0','0.00'] for r in zero)
status_counts={s:sum(r['data_quality_status']==s for r in daily) for s in sorted({r['data_quality_status'] for r in daily})}
result={'dataset_sha256':sha(FILE),'baseline_sha256':sha(BASE),'rows':len(daily),'days':28,'apps':len({r['app'] for r in daily}),'series_reconciled':len(results),'daily_values_checked_against_independent_sql':checked,'weekly_sales_control_groups':len(controls[0]),'weekly_equals_daily':True,'duplicate_and_calendar_failure_probes_passed':True,'status_counts':status_counts,'series':results}
(P/'daily-independent-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='series'},indent=2))
