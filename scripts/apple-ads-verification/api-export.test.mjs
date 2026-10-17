import{test}from'node:test';import assert from'node:assert/strict';import{validateAPI,decimalSum,cents,reconcileCSV,apiSnapshot,weeklySnapshots}from'./api-export.mjs';
function fixture(){return{source:'Apple Ads legacy v5 report (existing provider)',scope:{start:'2026-10-11',end:'2026-10-11',days:1,timezone:'UTC'},queriedAt:'2026-10-15T00:00:00Z',grain:'campaign/day/all campaign markets',databaseWrites:0,reports:[{campaignId:'1',appStoreId:'6785764991',campaignName:'Explicit synthetic test only',status:'observed',missingDays:0,rows:[{date:'2026-10-11',campaignId:'1',currency:'EUR',spend:'0.4918',impressions:52,taps:1,tapInstalls:0,viewInstalls:0,totalInstalls:0,newDownloads:0,redownloads:0}]}]};}
test('decimal summation retains precision and rounds only final totals',()=>{assert.equal(decimalSum(['0.0049','0.0049']),'0.0098');assert.equal(cents(decimalSum(['0.0049','0.0049'])),1);assert.equal(decimalSum(['1.8153','0.2042','0.6526']),'2.6721');});
test('rejects errors, missing counts, duplicate dates/campaigns and broken attribution',()=>{for(const mutate of[x=>x.error='failed',x=>delete x.reports[0].rows[0].taps,x=>x.reports[0].rows.push(x.reports[0].rows[0]),x=>x.reports.push(x.reports[0]),x=>x.reports[0].rows[0].totalInstalls=1]){const x=fixture();mutate(x);assert.throws(()=>validateAPI(x));}});
test('rejects invalid scope, currency and coverage claims',()=>{for(const mutate of[x=>x.scope.timezone='ORTZ',x=>x.scope.days=28,x=>x.reports[0].rows[0].currency='USD',x=>x.reports[0].rows[0].date='2026-10-12',x=>x.reports[0].missingDays=1]){const x=fixture();mutate(x);assert.throws(()=>validateAPI(x));}});
test('empty campaign remains unavailable and never receives synthetic zeros',()=>{const x=fixture();x.reports.push({campaignId:'2',appStoreId:'6785764991',rows:[],status:'no_reported_rows',missingDays:1});assert.equal(validateAPI(x).unreportedCampaignDays,1);assert.equal(apiSnapshot(x,'2026-10-11','2026-10-11','test',[]).campaigns[1].metrics,null);});
test('console mismatches and incomparable timezone fail rather than publish',()=>{const x=fixture(),s={timezone:'UTC',currency:'EUR',period_start:'2026-10-11',period_end:'2026-10-11',campaigns:[{campaign_id:'1',metrics:{Spend:49,Impressions:999}}],totals_in_cents_for_spend:{Spend:49,Impressions:999}};assert.throws(()=>reconcileCSV(x,s));s.timezone='ORTZ';assert.throws(()=>reconcileCSV(x,s));});

test('CPA divides exact spend before rounding',()=>{assert.equal(cents('7.5740',11),69);assert.equal(cents('0.0250',2),1);assert.throws(()=>cents('1.00',0));});

function twoWeekFixture(){
 const x=fixture();x.scope={start:'2026-10-01',end:'2026-10-14',days:14,timezone:'UTC'};
 x.reports[0].rows=Array.from({length:14},(_,i)=>({...fixture().reports[0].rows[0],date:new Date(Date.UTC(2026,9,i+1)).toISOString().slice(0,10),spend:i<7?'0.0049':'0.0000',impressions:10,taps:1,tapInstalls:1,totalInstalls:1,newDownloads:1}));
 return x;
}
test('weekly windows compare exact source spend before rounding and retain missing campaigns',()=>{
 const x=twoWeekFixture();x.reports.push({campaignId:'2',appStoreId:'6785764991',rows:[],status:'no_reported_rows',missingDays:14});
 const [latest,earliest]=weeklySnapshots(x,'explicit-test-only');
 assert.equal(latest.period_start,'2026-10-08');assert.equal(latest.period_end,'2026-10-14');
 assert.equal(latest.comparison.state,'comparable_observed_campaigns');
 assert.equal(latest.comparison.spend_change_exact,'-0.0343');assert.equal(latest.comparison.spend_change_cents,-3);
 assert.equal(latest.comparison.changes['Installs (Total)'],0);assert.equal(latest.comparison.observed_campaigns,1);assert.equal(latest.comparison.mapped_campaigns,2);
 assert.equal(latest.campaigns[1].metrics,null);assert.equal(earliest.comparison.state,'unavailable');assert.match(earliest.comparison.reason,/outside/);
});
test('missing days or changed observed campaign sets make weekly comparison unavailable',()=>{
 const x=twoWeekFixture();x.reports[0].rows.splice(10,1);x.reports[0].missingDays=1;
 assert.match(weeklySnapshots(x,'test')[0].comparison.reason,/missing days/);
 const y=twoWeekFixture();const moved=y.reports[0].rows.splice(7);y.reports[0].missingDays=7;
 y.reports.push({campaignId:'2',appStoreId:'6785764991',rows:moved.map(r=>({...r,campaignId:'2'})),status:'observed',missingDays:7});
 assert.equal(weeklySnapshots(y,'test')[0].comparison.state,'unavailable');
});
test('snapshot bounds fail closed and console subwindows never certify whole weeks',()=>{
 const x=twoWeekFixture();assert.throws(()=>apiSnapshot(x,'2026-09-30','2026-10-01','test'));assert.throws(()=>apiSnapshot(x,'2026-10-10','2026-10-09','test'));
 const [latest,earliest]=weeklySnapshots(x,'test');assert.equal(latest.console_controls_within_window.length,2);assert.match(latest.quality,/no independent full-week/);assert.equal(earliest.console_controls_within_window.length,0);assert.match(earliest.quality,/no external console reconciliation/);
});
