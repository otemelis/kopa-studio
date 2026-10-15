import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshHealth} from '../../reporting/portfolio/refresh-health.mjs';
const manifest={period_end:'2026-10-11',last_successful_refresh_utc:'2026-10-15T13:05:20Z'};
const attempt={last_attempt_utc:'2026-10-15T13:05:20Z',status:'success'};
test('fresh, historical, complete period and exact last successful timestamp remain explicit',()=>{
 const h=refreshHealth(manifest,attempt,new Date('2026-10-15T14:00:00Z'));assert.equal(h.status,'success');assert.match(h.message,/2026-10-11/);assert.match(h.message,/13:05:20Z/);
});
test('failed attempt retains truthful successful timestamp and reports failure, never zero',()=>{
 const h=refreshHealth(manifest,{...attempt,status:'failed',last_attempt_utc:'2026-10-15T14:00:00Z'},new Date('2026-10-15T14:01:00Z'));assert.equal(h.status,'failed');assert.match(h.message,/SOURCE REFRESH FAILED/);assert.match(h.message,/13:05:20Z/);assert.match(h.message,/14:00:00Z/);
});
test('old successful data is stale, while a missing attempt is explicitly unavailable',()=>{
 assert.equal(refreshHealth(manifest,attempt,new Date('2026-10-18T14:00:00Z')).status,'stale');assert.equal(refreshHealth(manifest,null).status,'unavailable');assert.equal(refreshHealth(manifest,{status:'success',last_attempt_utc:'bad'}).status,'unavailable');
});
