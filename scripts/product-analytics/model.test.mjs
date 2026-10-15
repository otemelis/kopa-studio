import test from 'node:test';import assert from 'node:assert/strict';import{scope,ratio,fillDays}from'./model.mjs';
test('complete UTC days independent of local timezone',()=>{const s=scope('pois','testflight',7,new Date('2026-10-15T02:30:00+02:00'));assert.equal(s.start,'2026-10-08T00:00:00.000Z');assert.equal(s.end,'2026-10-15T00:00:00.000Z');});
test('reject unsafe scope',()=>{for(const a of[['inner','testflight',28],['pois','debug',28],['pois','appstore',90]])assert.throws(()=>scope(...a));});
test('zero denominator never produces zero retention',()=>{assert.equal(ratio(0,0).percent,null);assert.equal(ratio(0,2).percent,0);assert.equal(ratio(1,2).percent,50);});
test('daily buckets do not sum into unique period installations',()=>{const s=scope('pois','testflight',7,new Date('2026-10-15Z'));const rows=fillDays(s,[{day:'2026-10-09',value:2},{day:'2026-10-10',value:1}]);assert.equal(rows.length,7);assert.deepEqual(rows.slice(0,3).map(x=>x.value),[0,2,1]);});
