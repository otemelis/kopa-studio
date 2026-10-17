import os
"""One-off offline daily CSV analysis. Reads preserved official reports; no network or app changes."""
import csv, gzip, hashlib, io, json, sys
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal as D
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
P=Path(os.environ.get('ASC_RUN_DIR',Path(__file__).parent/'private'))
BASE=Path(os.environ.get('ASC_BASE',ROOT/'outputs/inner-lovetype-28-day-report/acquisition-monetization-28-days.csv'))
OUT=Path(os.environ.get('ASC_CSV',ROOT/'outputs/inner-lovetype-daily-dataset/daily-acquisition-monetization.csv'))
START=date.fromisoformat(os.environ.get('ASC_START','2026-09-14')); DAYS=[(START+timedelta(days=i)).isoformat() for i in range(28)]
APPS=json.loads((Path(__file__).parent/'portfolio-apps.json').read_text())
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def inflate(blob): return gzip.decompress(blob) if blob[:2]==b'\x1f\x8b' else blob
def tsv(path):
    return [{k:v.strip() for k,v in r.items()} for r in csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig')),delimiter='\t')]
baseline=list(csv.DictReader(BASE.open(encoding='utf-8-sig')))
segments=json.loads((P/'segment-manifest.json').read_text())
analytics=[]
for m in segments:
    blob=(P/(m['filename']+'.gz')).read_bytes()
    assert hashlib.sha256(blob).hexdigest()==m['sha256'] and hashlib.md5(blob).hexdigest()==m['md5'] and len(blob)==m['bytes']
    assert inflate(blob)==(P/m['filename']).read_bytes()
    for r in tsv(P/m['filename']):
        assert r['App Apple Identifier']==APPS['InnerType'][0]
        analytics.append((m,r))
# Require an uninterrupted published-instance calendar for the regular commerce/discovery inputs.
for kind in ['discovery','downloads']:
    published={m['processingDate'] for m in segments if m['kind']==kind}
    assert set(DAYS).issubset(published) and max(published)>=(START+timedelta(days=30)).isoformat()
latest={}
for m,r in analytics:
    key=(m['kind'],r['Date'])
    latest[key]=max(latest.get(key,''),m['processingDate'])
selected=[(m,r) for m,r in analytics if r['Date'] in DAYS and m['processingDate']==latest[(m['kind'],r['Date'])]]
assert selected
for key in latest:
    ids={m['instanceId'] for m,r in selected if (m['kind'],r['Date'])==key}
    assert len(ids)<=1
sales_manifest=json.loads((P/'sales-manifest.json').read_text())
sales_by_day={m['date']:m for m in sales_manifest}
assert set(sales_by_day)==set(DAYS) and len(sales_manifest)==28
sales={}
for day,m in sales_by_day.items():
    original=P/(m['filename'] if m['status']!=200 else m['filename'].replace('.tsv','.gz'))
    assert sha(original)==m['sha256']
    if m['status']==404:
        assert json.loads(original.read_text())['errors'][0]['detail']=='There were no sales for the date specified.'
        sales[day]=[]
    else:
        assert m['status']==200
        assert inflate(original.read_bytes())==(P/m['filename']).read_bytes()
        sales[day]=tsv(P/m['filename'])
        assert all(date.fromisoformat(day).strftime('%m/%d/%Y')==r['Begin Date']==r['End Date'] for r in sales[day])
for app in APPS:
    if app!='InnerType':
        request=json.loads((P/f'{app}-requests-0.json').read_text());assert not request.get('links',{}).get('next')
        if request['data']:
            approved=json.loads((Path(__file__).parent/'approved-analytics-requests.json').read_text())
            assert len(request['data'])==1 and request['data'][0]['id']==approved[app] and request['data'][0]['attributes']['accessType']=='ONGOING' and not request['data'][0]['attributes']['stoppedDueToInactivity']

headers=['date','app','metric','source','value','data_quality_status','acquisition_source','scope','unit','currency','source_timezone','numerator','denominator','source_row_count','selected_processing_dates','evidence_files','evidence_sha256','definition','source_extracted_at_utc']
output=[]
for b in baseline:
    for day in DAYS:
        metric=b['metric']; app=b['app']; channel=b['source_type']; currency=b['currency']
        value=None; numerator=''; denominator=''; matches=[]; revisions=''; row_count=''
        evidence=b['evidence_file']; evidence_files=evidence; evidence_hash=sha(P/evidence); extracted_at=b['retrieved_at_utc']
        if b['status']=='unavailable':
            quality='unavailable_source_capability'
            if app!='InnerType' and evidence==f'{app}-requests-0.json':
                quality='unavailable_analytics_pending_validation' if json.loads((P/evidence).read_text())['data'] else 'unavailable_no_analytics_request'; evidence_files=f'{app}-requests-0.json'; evidence_hash=sha(P/evidence_files)
                extracted_at=max(m['retrievedAt'] for m in json.loads((P/'retrieval-log.json').read_text()) if m['file']==evidence_files)
        elif metric.endswith('_sales') or metric=='estimated_proceeds_native_currency':
            identifier,sku=APPS[app]
            matches=[r for r in sales[day] if (r['SKU']==sku and r['Apple Identifier']==identifier) or r['Parent Identifier']==sku]
            if metric=='first_time_app_units_sales':
                matches=[r for r in matches if r['Product Type Identifier']=='1' and r['Apple Identifier']==identifier and r['SKU']==sku]
                value=sum(D(r['Units']) for r in matches)
            elif metric=='apple_reported_paid_iap_units_sales':
                matches=[r for r in matches if r['Parent Identifier']==sku and r['Product Type Identifier']=='IA1' and D(r['Customer Price'])>0 and D(r['Units'])>0]
                value=sum(D(r['Units']) for r in matches)
            else:
                matches=[r for r in matches if r['Currency of Proceeds']==currency]
                value=sum((D(r['Units'])*D(r['Developer Proceeds']) for r in matches),D(0))
            m=sales_by_day[day]; evidence_files=m['filename']; evidence_hash=sha(P/evidence_files); row_count=len(matches); extracted_at=m['retrievedAt']
            quality='reported_value' if value!=0 else 'zero_matching_rows' if matches else 'zero_apple_no_sales' if m['status']==404 else 'zero_no_matching_sales_rows'
        else:
            def subset(kind,condition=lambda r:True):
                return [(m,r) for m,r in selected if r['Date']==day and m['kind']==kind and (channel=='All sources' or r['Source Type']==channel) and condition(r)]
            kind='discovery' if metric in ['icon_impressions','product_page_views'] else 'downloads' if metric in ['first_time_downloads','product_page_first_downloads_per_view'] else 'purchases'
            if metric=='product_page_first_downloads_per_view':
                a=subset('downloads',lambda r:r['Download Type']=='First-time download' and r['Page Type']=='Product page')
                c=subset('discovery',lambda r:r['Event']=='Page view' and r['Page Type']=='Product page')
                numerator=sum(int(r['Counts']) for m,r in a); denominator=sum(int(r['Counts']) for m,r in c)
                matches=a+c; value=D(numerator)*100/D(denominator) if denominator else None
                quality='derived_event_ratio' if denominator else 'undefined_zero_denominator'
                kinds=['discovery','downloads']
            else:
                conditions={'icon_impressions':lambda r:r['Event']=='Impression','product_page_views':lambda r:r['Event']=='Page view' and r['Page Type']=='Product page','first_time_downloads':lambda r:r['Download Type']=='First-time download'}
                matches=subset(kind,conditions.get(metric,lambda r:True)); kinds=[kind]
                field='Proceeds in USD' if metric=='estimated_proceeds_usd' else 'Purchases' if metric=='apple_reported_purchase_units_net' else 'Counts'
                value=sum((D(r[field]) for m,r in matches),D(0))
                quality='reported_value' if value!=0 else 'zero_matching_rows' if matches else 'zero_no_rows_in_validated_standard_extract'
            revisions=';'.join(f'{k}:{latest[(k,day)]}' for k in kinds if (k,day) in latest)
            # Reference entire selected date partitions, not just positive metric rows.
            files=sorted({m['filename'] for m,r in selected if r['Date']==day and m['kind'] in kinds})
            evidence_files=';'.join(files) if files else 'segment-manifest.json'
            evidence_hash=';'.join(sha(P/f) for f in files) if files else sha(P/'segment-manifest.json')
            row_count=len(matches)
        rendered='' if value is None else f'{value:.6f}' if b['unit']=='percent of event counts' else f'{value:.2f}' if b['unit']=='estimated money' else str(int(value))
        output.append(dict(zip(headers,[day,app,metric,b['source_report'],rendered,quality,channel,b['scope'],b['unit'],currency,b['source_timezone'],numerator,denominator,row_count,revisions,evidence_files,evidence_hash,b['definition_or_calculation'],extracted_at])))

# Reconcile every original series; event ratios are recomputed from sums of their daily components.
reconciliation=[]
for b in baseline:
    daily=[r for r in output if (r['app'],r['metric'],r['acquisition_source'],r['currency'])==(b['app'],b['metric'],b['source_type'],b['currency'])]
    assert len(daily)==28
    if b['status']=='unavailable':
        assert all(r['value']=='' and r['data_quality_status'].startswith('unavailable') for r in daily)
        result='unavailable_preserved'; actual=''
    elif b['unit']=='percent of event counts':
        n=sum(int(r['numerator']) for r in daily); d=sum(int(r['denominator']) for r in daily)
        actual=f'{D(n)*100/D(d):.6f}' if d else ''
        assert actual==b['value'] and n==int(b['numerator']) and d==int(b['denominator'])
        result='ratio_components_match' if d else 'undefined_preserved'
    else:
        assert all(r['value']!='' for r in daily)
        actual=sum((D(r['value']) for r in daily),D(0)); assert actual==D(b['value'])
        result='sum_matches'
    reconciliation.append({'app':b['app'],'metric':b['metric'],'source_type':b['source_type'],'currency':b['currency'],'expected':b['value'],'actual':str(actual),'result':result})
output.sort(key=lambda r:(r['date'],r['app'],r['scope'],r['metric'],r['acquisition_source'],r['currency']))
assert len(output)==len(baseline)*28 and len({(r['date'],r['app'],r['metric'],r['acquisition_source'],r['currency']) for r in output})==len(baseline)*28
buf=io.StringIO(newline='');writer=csv.DictWriter(buf,fieldnames=headers);writer.writeheader();writer.writerows(output)
if '--verify-only' in sys.argv:
    assert list(csv.DictReader(OUT.open(encoding='utf-8-sig')))==list(csv.DictReader(io.StringIO(buf.getvalue())))
else:
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(buf.getvalue(),encoding='utf-8-sig',newline='')
    (P/'daily-reconciliation.json').write_text(json.dumps({'baseline_sha256':sha(BASE),'rows':len(output),'series':len(baseline),'checks':reconciliation},indent=2)+'\n')
print(json.dumps({'rows':len(output),'dates':len(DAYS),'apps':len(APPS),'baseline_series':len(baseline),'results':dict((k,sum(r['result']==k for r in reconciliation)) for k in sorted({r['result'] for r in reconciliation}))},indent=2))
