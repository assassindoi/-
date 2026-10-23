import test from 'node:test';
import assert from 'node:assert/strict';
import {dateKey,weekly,stats} from '../src/model.js';
test('練習回数と時間は同日の複数回もすべて集計する',()=>{const today=dateKey();const result=stats([{date:today,minutes:5},{date:today,minutes:10},{date:'2000-01-01',minutes:7}]);assert.deepEqual(result,{count:3,minutes:22,today:2})});
test('直近7日間の練習を日別集計し、範囲外を含めない',()=>{const now=new Date(2026,9,24,12);const result=weekly([{date:'2026-10-24',minutes:5},{date:'2026-10-24',minutes:10},{date:'2026-10-18',minutes:3},{date:'2026-10-17',minutes:100}],now);assert.equal(result.length,7);assert.equal(result[0].key,'2026-10-18');assert.equal(result[6].minutes,15);assert.equal(result.reduce((n,d)=>n+d.minutes,0),18)});
test('記録がなくても7日分のゼロを返す',()=>assert.deepEqual(weekly([]).map(x=>x.minutes),[0,0,0,0,0,0,0]));
