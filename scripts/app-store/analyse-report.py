import os
"""One-off, offline CSV analysis of preserved official Apple reports. No application code."""
import csv, hashlib, io, json, sqlite3, sys
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal as D
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = Path(os.environ.get('ASC_RUN_DIR',Path(__file__).parent / 'private'))
OUT = Path(os.environ.get('ASC_SUMMARY_DIR',ROOT / 'outputs/inner-lovetype-28-day-report'))
START, END = os.environ.get('ASC_START','2026-09-14'), os.environ.get('ASC_END','2026-10-11')
APPS = {'InnerType': ('6785764991', 'innertype-v1'), 'LoveType': ('6786477464', 'lovetype-ios-001')}
DOC = 'https://developer.apple.com/documentation/analytics-reports/'
SALES_DOC = 'https://developer.apple.com/help/app-store-connect/reference/reporting/summary-sales-report/'
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def cents(v):
    x = D(v) * 100
    assert x == x.to_integral_value(), ('Non-cent amount', v)
    return int(x)
def read(path):
    with path.open(newline='', encoding='utf-8-sig') as f:
        return [{k: v.strip() for k,v in r.items()} for r in csv.DictReader(f, delimiter='\t')]

manifest = json.loads((P/'segment-manifest.json').read_text())
raw = []
for m in manifest:
    compressed = (P/(m['filename']+'.gz')).read_bytes()
    assert hashlib.md5(compressed).hexdigest() == m['md5'] and digest(P/(m['filename']+'.gz')) == m['sha256']
    for r in read(P/m['filename']):
        assert r['App Apple Identifier'] == APPS['InnerType'][0]
        raw.append((m['kind'],r['Date'],m['processingDate'],m['instanceId'],m['segmentId'],r['Source Type'],r.get('Event',''),r['Page Type'],r.get('Download Type',''),r.get('Content Apple Identifier',''),int(r.get('Counts',0)),int(r.get('Purchases',0)),cents(r.get('Proceeds in USD','0'))))
db = sqlite3.connect(':memory:')
db.execute('CREATE TABLE raw(kind,event_date,processing_date,instance_id,segment_id,source_type,event,page_type,download_type,content_id,counts INTEGER,purchases INTEGER,proceeds_cents INTEGER)')
db.executemany('INSERT INTO raw VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',raw)
db.execute(f'''CREATE TEMP VIEW selected AS SELECT * FROM raw r
 WHERE event_date BETWEEN '{START}' AND '{END}'
 AND processing_date=(SELECT MAX(processing_date) FROM raw z WHERE z.kind=r.kind AND z.event_date=r.event_date)''')
selected = list(db.execute('SELECT * FROM selected'))
assert not list(db.execute('SELECT kind,event_date FROM selected GROUP BY kind,event_date HAVING COUNT(DISTINCT instance_id)>1'))
assert db.execute("SELECT COUNT(DISTINCT event_date) FROM selected WHERE kind='discovery'").fetchone()[0] == 28
def total(kind, column, where='', args=()):
    assert column in ['counts','purchases','proceeds_cents']
    return db.execute(f'SELECT COALESCE(SUM({column}),0) FROM selected WHERE kind=? '+where,(kind,*args)).fetchone()[0]

sales_manifest = json.loads((P/'sales-manifest.json').read_text())
weekly_manifest = json.loads((P/'sales-weekly-manifest.json').read_text())
assert len(sales_manifest)==28 and len(weekly_manifest)>=3 and all(m['status']==200 for m in weekly_manifest)
daily, weekly = [], []
for m in sales_manifest:
    if m['status']==404:
        error=json.loads((P/m['filename']).read_text())
        assert error['errors'][0]['detail']=='There were no sales for the date specified.'
        continue
    assert m['status']==200
    assert digest(P/m['filename'].replace('.tsv','.gz'))==m['sha256']
    rows=read(P/m['filename'])
    day=date.fromisoformat(m['date']).strftime('%m/%d/%Y')
    assert all(r['Begin Date']==r['End Date']==day for r in rows)
    daily.extend(rows)
for m in weekly_manifest:
    assert digest(P/m['filename'].replace('.tsv','.gz'))==m['sha256']
    rows=read(P/m['filename']); end=date.fromisoformat(m['date'])
    assert all(r['Begin Date']==(end-timedelta(days=6)).strftime('%m/%d/%Y') and r['End Date']==end.strftime('%m/%d/%Y') for r in rows)
    weekly.extend(rows)
def app_of(r):
    matches=[app for app,(identifier,sku) in APPS.items() if (r['SKU']==sku and r['Apple Identifier']==identifier) or r['Parent Identifier']==sku]
    assert len(matches)==1, 'Unmapped or ambiguous sales row'
    return matches[0]
def sales_control(rows):
    result=defaultdict(lambda:[0,0])
    for r in rows:
        n=D(r['Units']); assert n==n.to_integral_value()
        k=(app_of(r),r['Product Type Identifier'],r['Country Code'],r['Currency of Proceeds'])
        result[k][0]+=int(n); result[k][1]+=cents(n*D(r['Developer Proceeds']))
    return dict(result)
control_days={ (date.fromisoformat(m['date'])-timedelta(days=i)).strftime('%m/%d/%Y') for m in weekly_manifest for i in range(7)}
assert sales_control([r for r in daily if r['End Date'] in control_days])==sales_control(weekly), 'Daily/weekly sales reconciliation failed'
purchase_rows=[r for r in daily if r['Product Type Identifier']=='IA1' and D(r['Customer Price'])>0 and D(r['Units'])>0]
sale_iap=defaultdict(int)
for r in purchase_rows: sale_iap[(r['Apple Identifier'],r['Country Code'])]+=int(D(r['Units']))
analytic_iap=defaultdict(int)
for m in manifest:
    if m['kind']!='purchases': continue
    for r in read(P/m['filename']):
        if any(x[3]==m['instanceId'] and x[1]==r['Date'] for x in selected):
            analytic_iap[(r['Content Apple Identifier'],r['Territory'])]+=int(r['Purchases'])
purchase_alignment = dict(sale_iap)==dict(analytic_iap)
downloads_alignment = total('downloads','counts',"AND download_type='First-time download'")==sum(int(D(r['Units'])) for r in daily if app_of(r)=='InnerType' and r['Product Type Identifier']=='1')

columns=['scope','app','app_apple_id','period_start','period_end_inclusive','territories','metric','source_type','value','unit','currency','status','numerator','denominator','source_report','source_timezone','definition_or_calculation','validation_result','evidence_file','evidence_sha256','definition_url','retrieved_at_utc']
rows=[]
def add(app,metric,value,unit,report,definition,validation,*,source='All sources',currency='',status='validated',numerator='',denominator='',evidence='segment-manifest.json',url='',timezone='UTC'):
    evidence_body=json.loads((P/evidence).read_text())
    dates=[m.get('retrievedAt','') for m in evidence_body] if isinstance(evidence_body,list) else []
    if not dates: dates=[m['retrievedAt'] for m in json.loads((P/'retrieval-log.json').read_text()) if m['file']==evidence]
    rows.append(dict(zip(columns,['summary' if source=='All sources' else 'source_breakdown',app,APPS[app][0],START,END,'All',metric,source,'' if value is None else str(value),unit,currency,status,str(numerator),str(denominator),report,timezone,definition,validation,evidence,digest(P/evidence),url,max(dates)])))
REPORTS={'discovery':'App Store Discovery and Engagement Standard','downloads':'App Downloads Standard','purchases':'App Store Purchases Standard'}
for source in ['All sources','App Store search','App Store browse','App referrer','Web referrer']:
    extra='' if source=='All sources' else 'AND source_type=?'
    args=() if source=='All sources' else (source,)
    def val(kind,col,condition=''): return total(kind,col,extra+' '+condition,args)
    common='All segments checksum-verified; latest processing-date partition only; Standard report; additive counts, not unique users.'
    impressions=val('discovery','counts',"AND event='Impression'")
    views=val('discovery','counts',"AND event='Page view' AND page_type='Product page'")
    downloads=val('downloads','counts',"AND download_type='First-time download'")
    from_page=val('downloads','counts',"AND download_type='First-time download' AND page_type='Product page'")
    purchases=val('purchases','purchases')
    for metric,value,unit,kind,definition in [
      ('icon_impressions',impressions,'events','discovery',"SUM(Counts) WHERE Event='Impression'. Icon/list impressions exclude page views; not necessarily the ASC UI impressions headline."),
      ('product_page_views',views,'events','discovery',"SUM(Counts) WHERE Event='Page view' AND Page Type='Product page'. Repeated views remain; excludes developer pages and store sheets."),
      ('first_time_downloads',downloads,'Apple-account first downloads','downloads',"SUM(Counts) WHERE Download Type='First-time download'. Not installs, first opens, updates or redownloads."),
      ('apple_reported_purchase_units_net',purchases,'purchase units','purchases','SUM(Purchases). Official paid app/IAP aggregates; refunds negative. Not unique paying people or transaction-ID verification.'),
      ('estimated_proceeds_usd',f"{D(val('purchases','proceeds_cents'))/100:.2f}",'estimated money','purchases','SUM(Proceeds in USD). Apple estimate after taxes/commission; not settled bank proceeds.')]:
        add('InnerType',metric,value,unit,REPORTS[kind],definition,common+((' Purchase total matches Sales by product ID and territory.' if purchase_alignment else ' UTC Analytics and Pacific Sales period totals differ; no transaction-level join asserted.') if kind=='purchases' else ''),source=source,currency='USD' if kind=='purchases' and metric=='estimated_proceeds_usd' else '',url=DOC+{'discovery':'app-store-discovery-and-engagement','downloads':'app-download','purchases':'app-store-purchase'}[kind])
    add('InnerType','product_page_first_downloads_per_view',None if views==0 else f'{D(from_page)*100/D(views):.6f}','percent of event counts',REPORTS['downloads']+' + '+REPORTS['discovery'],'100 * first-time download Counts with Page Type=Product page / product-page view Counts, same UTC period and source. Descriptive event ratio; not an ordered funnel, unique-user conversion or Apple official conversion rate.',common if views else 'Undefined: denominator is zero; not reported as zero conversion.',source=source,status='validated_event_ratio' if views else 'undefined_zero_denominator',numerator=from_page,denominator=views,url=DOC+'app-download')

for app in APPS:
    relevant=[r for r in daily if app_of(r)==app]
    first=sum(int(D(r['Units'])) for r in relevant if r['Product Type Identifier']=='1')
    paid=[r for r in relevant if r['Product Type Identifier']=='IA1' and D(r['Customer Price'])>0 and D(r['Units'])>0]
    validation=f'Independent raw daily SQL and {len(weekly_manifest)} complete weekly controls by app/product type/territory/currency, units and cents; weekly control coverage {len(control_days)} of 28 days. Boundary days outside full weeks have raw daily SQL checks only.'
    add(app,'first_time_app_units_sales',first,'first-time app units','Summary Sales 1_0 DAILY + WEEKLY',"SUM(Units) for exact app Apple ID and SKU, Product Type Identifier='1'; excludes PTI 3 redownloads, PTI 7 updates and IA1 IAP.",validation,timezone='America/Los_Angeles (downloaded Sales report dates)',evidence='sales-manifest.json',url=SALES_DOC)
    add(app,'apple_reported_paid_iap_units_sales',sum(int(D(r['Units'])) for r in paid),'paid IAP units','Summary Sales 1_0 DAILY + WEEKLY',"SUM(positive Units) WHERE Parent Identifier=exact app SKU AND PTI='IA1' AND Customer Price>0. Source-validated aggregate; not distinct people or verified transaction IDs.",validation,timezone='America/Los_Angeles (downloaded Sales report dates)',evidence='sales-manifest.json',url=SALES_DOC)
    currencies=sorted({r['Currency of Proceeds'] for r in relevant if D(r['Developer Proceeds'])!=0})
    for currency in currencies or ['']:
        amount=sum((D(r['Units'])*D(r['Developer Proceeds']) for r in relevant if r['Currency of Proceeds']==currency),D(0))
        add(app,'estimated_proceeds_native_currency',f'{amount:.2f}','estimated money', 'Summary Sales 1_0 DAILY + WEEKLY','SUM(Units * Developer Proceeds) grouped by Currency of Proceeds; no currency conversion. Blank currency with zero means no revenue-bearing rows, not an invented USD total.',validation,currency=currency,timezone='America/Los_Angeles (downloaded Sales report dates)',evidence='sales-manifest.json',url=SALES_DOC)
    for metric,reason in [
      ('unique_paying_customers','Paying Users cannot be summed across Analytics rows; Sales has no unique customer identity.'),
      ('download_to_paying_customer_conversion','No common identifiable download cohort and distinct paying-user denominator; do not divide purchase units by downloads.'),
      ('product_journey_dropoff','Store reports contain no in-app assessment/paywall step sequence or linked user identities.'),
      ('organic_only_acquisition','App Store search includes Apple Ads; no defensible organic-only split in these reports.'),
      ('paid_channel_roas','No independently joined ad spend and verified customer attribution for Apple Ads/Meta/Google/TikTok; referrer type does not identify a specific paid network.')]:
        add(app,metric,None,'unavailable','Official Apple report capability',reason,'Not computed; missing required source/population.',status='unavailable',evidence='sales-weekly-manifest.json' if app=='LoveType' else 'segment-manifest.json',url=DOC+'app-store-purchase')
    if app=='LoveType':
        for metric in ['icon_impressions','product_page_views','first_time_downloads_by_source','purchases_by_acquisition_source','product_page_first_downloads_per_view']:
            add(app,metric,None,'unavailable','Analytics report requests GET','No existing Analytics Report Request for this app. No current Analytics export available. No request was created under the read-only scope.','GET /v1/apps/6786477464/analyticsReportRequests returned an empty complete list; missing data is not zero.',status='unavailable',evidence='LoveType-requests-0.json',url='https://developer.apple.com/documentation/appstoreconnectapi/downloading-analytics-reports')

checks={'period':[START,END],'days':28,'segmentsVerified':len(manifest),'selectedRows':len(selected),'dailyHTTP200':sum(m['status']==200 for m in sales_manifest),'dailyExplicitNoSales':sum(m['status']==404 for m in sales_manifest),'weeklyHTTP200':len(weekly_manifest),'weekly_control_days':len(control_days),'dailyEqualsWeekly':True,'analyticsPurchasesEqualSalesByProductAndTerritory':purchase_alignment,'innerTypeFirstDownloadsEqualAcrossAppleSources':downloads_alignment,'sourcePurchaseCounts':dict(db.execute("SELECT source_type,SUM(purchases) FROM selected WHERE kind='purchases' GROUP BY source_type")),'reportRows':len(rows)}
text=io.StringIO(newline='');writer=csv.DictWriter(text,fieldnames=columns);writer.writeheader();writer.writerows(rows)
target=OUT/'acquisition-monetization-28-days.csv'
if '--verify-only' in sys.argv:
    assert list(csv.DictReader(io.StringIO(target.read_text(encoding='utf-8-sig'))))==list(csv.DictReader(io.StringIO(text.getvalue())))
else:
    OUT.mkdir(parents=True,exist_ok=True)
    target.write_text(text.getvalue(),encoding='utf-8-sig',newline='')
    (P/'validation.json').write_text(json.dumps(checks,indent=2)+'\n')
    with (P/'selected-analytics.csv').open('w',newline='') as f:
        w=csv.writer(f);w.writerow([c[0] for c in db.execute('SELECT * FROM selected LIMIT 0').description]);w.writerows(selected)
print(json.dumps(checks,indent=2))
