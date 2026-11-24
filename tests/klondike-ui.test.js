const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../klondike/js/logic.js'),dom=require('./helpers/game-dom.js');
const GAME='maeil-game.klondike.game.v1',STATS='maeil-game.klondike.stats.v1',DAILY='maeil-game.klondike.daily.v1';
const browser=(options={})=>dom('klondike',{scripts:['common/card-table.js','klondike/js/deals.js'],...options});
function point(b,p){
 if(p.type==='waste')return b.element('waste-slot').children[0];
 if(p.type==='foundation')return b.element('foundations').children[p.index];
 const button=b.element('column-buttons').children[p.index];if(p.start===undefined)return button;
 button.fire('click');return b.element('card-picker-list').children[p.start];
}
function play(b,a){if(a.type==='draw')b.click('draw-btn');else{point(b,a.from).fire('click');point(b,a.to).fire('click');}}
function almostDone(daily=null){const s=G.create('medium',{daily,dealNumber:88});for(const a of s.solution.slice(0,-1)){if(a.type==='draw')G.draw(s);else G.move(s,a.from,a.to);}return s;}
test('시작·7줄 전체보기·뒷면 21장·덱 24장과 큰 선택 창',()=>{
 const b=browser();b.click('start-btn');const s=b.get(GAME);assert.ok(G.isValid(s));assert.equal(s.stock.length,24);assert.equal(b.element('column-buttons').children.length,7);
 const hidden=b.element('tableau').children.flatMap(c=>c.children).filter(c=>c.attributes['aria-label']==='뒷면 카드');assert.equal(hidden.length,21);
 b.element('column-buttons').children[6].fire('click');const items=b.element('card-picker-list').children;assert.equal(items.length,7);assert.equal(items.filter(c=>c.disabled).length,6);
 assert.ok(items.slice(0,6).every(c=>c.textContent.includes('뒷면')));assert.deepEqual(b.get(GAME),s);b.click('card-picker-close');
});
test('덱 뽑기·24장 순환·되돌리기·저장',()=>{
 const b=browser();b.click('start-btn');const first=b.get(GAME);b.click('draw-btn');assert.equal(b.get(GAME).waste.at(-1),first.stock.at(-1));assert.equal(b.get(GAME).moves,1);
 b.click('undo-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(first));
 for(let i=0;i<24;i++)b.click('draw-btn');b.click('draw-btn');assert.equal(b.get(GAME).passes,1);assert.deepEqual(b.get(GAME).stock,first.stock);
});
test('추천 이동과 뽑기 추천은 실행 전 판을 바꾸지 않음',()=>{
 const b=browser();b.click('start-btn');const s=b.get(GAME),m=G.hint(s,G.solutionMap(s));b.click('hint-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(s));assert.equal(b.get(GAME).hintsUsed,1);
 if(m.type==='draw')b.click('draw-btn');else point(b,m.to).fire('click');assert.equal(b.get(GAME).moves,1);
});
test('검증 수순 전체를 화면 조작으로 끝까지 재생',()=>{
 const b=browser();b.click('start-btn');const initial=b.get(GAME);for(const a of initial.solution)play(b,a);
 assert.equal(b.element('result-screen').hidden,false);assert.equal(b.get(GAME),null);assert.equal(b.get(STATS).medium.played,1);
 assert.equal(b.get(STATS).medium.best.moves,initial.solution.length);b.window.fire('pagehide');assert.equal(b.get(STATS).medium.played,1);
 b.click('again-btn');assert.deepEqual(b.get(GAME).initial,initial.initial);assert.equal(b.get(GAME).moves,0);
});
test('뒷면이 노출되면 뒤집히고 되돌리기로 숨김도 복원',()=>{
 const state=G.create('medium',{dealNumber:13});let chosen;
 for(const a of state.solution){if(a.from?.type==='column'&&state.hidden[a.from.index]>0&&a.from.start===state.hidden[a.from.index]){chosen=a;break;}if(a.type==='draw')G.draw(state);else G.move(state,a.from,a.to);}
 assert.ok(chosen);const b=browser({saved:{[GAME]:state}});b.click('continue-btn');play(b,chosen);
 assert.equal(b.get(GAME).hidden[chosen.from.index],state.hidden[chosen.from.index]-1);b.click('undo-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(state));
});
test('일시정지·회전·이어하기는 카드 순서와 숨김을 보존',()=>{
 const b=browser();b.click('start-btn');b.click('draw-btn');b.advance(1200);b.click('pause-btn');const saved=b.get(GAME);
 b.advance(5000);b.click('draw-btn');assert.deepEqual(b.get(GAME),saved);b.window.fire('resize');assert.deepEqual(b.get(GAME),saved);
 const c=browser({saved:{[GAME]:saved}});c.click('continue-btn');assert.deepEqual(G.snapshot(c.get(GAME)),G.snapshot(saved));
 c.document.hidden=true;c.document.fire('visibilitychange');assert.equal(c.element('pause-overlay').hidden,false);
});
test('같은 날짜 도전·완료 출석·지난 날짜 기록 보존',()=>{
 const a=browser({hash:'#daily'}),b=browser({hash:'#daily'});assert.deepEqual(a.get(GAME),b.get(GAME));assert.equal(a.get(GAME).daily,'2026-11-23');
 const s=almostDone('2026-11-23'),c=browser({saved:{[GAME]:s}});c.click('continue-btn');play(c,s.solution.at(-1));assert.ok(c.get('maeil-game.daily.v1').done['2026-11-23'].includes('klondike'));
 const previous={date:'2026-11-23',moves:250,seconds:900,hints:0,undos:0},old=almostDone('2026-11-22'),d=browser({saved:{[GAME]:old,[DAILY]:previous}});d.click('continue-btn');play(d,old.solution.at(-1));assert.deepEqual(d.get(DAILY),previous);
});
test('같은 판 재시작 확인·자동 정리와 전체 되돌리기',()=>{
 const state=G.create('easy',{dealNumber:7});for(const a of state.solution){if(G.safeMove(state))break;if(a.type==='draw')G.draw(state);else G.move(state,a.from,a.to);}
 const b=browser({saved:{[GAME]:state}});b.click('continue-btn');b.click('auto-btn');assert.ok(G.foundationCount(b.get(GAME))>G.foundationCount(state));b.click('undo-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(state));
 b.click('restart-btn');assert.notEqual(b.get(GAME).moves,0);b.click('restart-btn');assert.equal(b.get(GAME).moves,0);assert.deepEqual(b.get(GAME).initial,state.initial);
});
test('손상된 저장 무시·저장소 차단 상태에서도 진행',()=>{
 const bad=browser({saved:{[GAME]:{columns:[]},[STATS]:'손상'}});assert.equal(bad.element('continue-wrap').hidden,true);bad.click('start-btn');assert.ok(G.isValid(bad.get(GAME)));
 const b=browser({blockedStorage:true});b.click('start-btn');b.click('draw-btn');assert.equal(b.element('moves').textContent,'1');b.click('undo-btn');assert.equal(b.element('moves').textContent,'0');b.click('pause-btn');assert.equal(b.element('pause-overlay').hidden,false);
});
