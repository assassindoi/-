import test from 'node:test';
import assert from 'node:assert/strict';
import {miroExercises,appendExerciseMemo,miroSummaries} from '../src/miro-guides.js';
test('個別注意点を追加しても手書きメモを消さず、同じ注意点を二重に追加しない',()=>{const exercise=miroExercises.find(e=>e.id==='long-five');const initial='自分の気づき：今日は息が多い';const result=appendExerciseMemo(initial,exercise);assert.ok(result.startsWith(initial));assert.ok(result.includes('15秒'));assert.equal(appendExerciseMemo(result,exercise),result)});
test('個別素材の時間を全体方針の目安で上書きしない',()=>{assert.match(miroExercises.find(e=>e.id==='long-one').body,/30秒/);assert.match(miroExercises.find(e=>e.id==='long-five').body,/15秒/)});
test('過去の記録には年が不明であることと時系列の不確実さを残す',()=>{const body=miroSummaries.find(n=>n.id==='miro-observations-v1').body;assert.match(body,/年は不明/);assert.match(body,/時系列は未確認/)});
