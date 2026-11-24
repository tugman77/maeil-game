// 실제 core/start/logic/ai/ui. CSS 렌더링 및 실기기 터치는 별도 검수 대상이다.
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../janggi/js/logic.js'),AI=require('../janggi/js/ai.js'),dom=require('./helpers/game-dom.js');
const GAME='maeil-game.janggi.game.v1',STATS='maeil-game.janggi.stats.v1',DAILY='maeil-game.janggi.daily.v1';
const browser=options=>dom('janggi',options),point=(b,i)=>b.element('board').children[i];
function play(b,a){point(b,a.from).fire('click');point(b,a.to).fire('click');}
function reply(worker){worker.reply(AI.chooseMove(worker.data.state,{depth:1,nodes:200}));}
test('기본 90점·한자 말·초 선공·포진 선택',()=>{
 const b=browser();b.element('formation-select').value='1';b.click('start-btn');const s=b.get(GAME);
 assert.ok(G.isValid(s));assert.equal(s.formation,1);assert.equal(b.element('board').children.length,90);assert.equal(point(b,76).textContent,'楚');
 assert.equal(b.element('cho-points').textContent,'72');assert.equal(b.element('han-points').textContent,'73.5');assert.equal(b.element('undo-btn').disabled,true);
});
test('말 선택·이동 후보·바로 이동·컴퓨터 응수·한 차례 무르기',()=>{
 const b=browser();b.click('start-btn');const initial=b.get(GAME),a=G.legalMoves(initial)[0];
 point(b,a.from).fire('click');assert.equal(point(b,a.to).classList.contains('legal'),true);assert.equal(point(b,a.from).attributes['aria-selected'],'true');
 point(b,a.to).fire('click');assert.equal(b.get(GAME).turn,-1);assert.equal(b.get(GAME).actions.length,1);assert.equal(b.element('hint-btn').disabled,true);
 b.advance(260);reply(b.workers[0]);assert.equal(b.get(GAME).turn,1);assert.equal(b.get(GAME).actions.length,2);assert.ok(G.isValid(b.get(GAME)));
 b.click('undo-btn');assert.deepEqual(b.get(GAME).board,initial.board);assert.equal(b.get(GAME).actions.length,0);assert.equal(b.get(GAME).undoUsed,1);
});
test('이동 불가능한 점·상대 말은 판을 바꾸지 않고 선택 재누르기로 취소',()=>{
 const b=browser();b.click('start-btn');const before=b.get(GAME);point(b,54).fire('click');point(b,0).fire('click');assert.deepEqual(b.get(GAME),before);
 point(b,54).fire('click');assert.equal(b.element('clear-pick-btn').disabled,true);
});
test('계산 중 무르기·처음 화면은 늦은 Worker 응답을 폐기',()=>{
 const b=browser();b.click('start-btn');const initial=b.get(GAME);play(b,G.legalMoves(initial)[0]);b.advance(260);const worker=b.workers[0];
 b.click('undo-btn');const restored=b.get(GAME);assert.equal(worker.terminated,true);reply(worker);assert.deepEqual(b.get(GAME),restored);
 play(b,G.legalMoves(restored)[0]);b.advance(260);const second=b.workers[1];b.click('home-btn');const saved=b.get(GAME);reply(second);assert.deepEqual(b.get(GAME),saved);assert.equal(b.element('start-screen').hidden,false);
 b.click('continue-btn');b.advance(260);reply(b.workers[2]);assert.equal(b.get(GAME).turn,1);
});
test('일시정지·탭 숨김·bfcache·저장 이어하기와 새 계산',()=>{
 const b=browser();b.click('start-btn');play(b,G.legalMoves(b.get(GAME))[0]);b.advance(1200);const worker=b.workers[0];b.click('pause-btn');const paused=b.get(GAME);
 b.advance(7000);reply(worker);assert.deepEqual(b.get(GAME),paused);assert.equal(b.element('pause-overlay').hidden,false);
 b.click('resume-btn');b.advance(260);reply(b.workers[1]);assert.equal(b.get(GAME).turn,1);
 b.document.hidden=true;b.document.fire('visibilitychange');assert.equal(b.element('pause-overlay').hidden,false);
 const c=browser({saved:{[GAME]:b.get(GAME)}});c.click('continue-btn');assert.deepEqual(c.get(GAME).board,b.get(GAME).board);
 c.window.fire('pagehide');c.window.fire('pageshow',{persisted:true});assert.equal(c.element('pause-overlay').hidden,false);
});
test('Worker 없음·오류·시간 초과는 제한 탐색으로 합법 응수',()=>{
 const a=browser({workers:false});a.click('start-btn');play(a,G.legalMoves(a.get(GAME))[0]);a.advance(340);assert.equal(a.get(GAME).turn,1);assert.ok(G.isValid(a.get(GAME)));
 const b=browser();b.click('start-btn');play(b,G.legalMoves(b.get(GAME))[0]);b.advance(260);const worker=b.workers[0];worker.onmessage({data:{id:worker.data.id,error:true}});b.advance(30);assert.equal(b.get(GAME).turn,1);
 const c=browser();c.click('start-btn');play(c,G.legalMoves(c.get(GAME))[0]);c.advance(6400);assert.equal(c.workers[0].terminated,true);assert.equal(c.get(GAME).turn,1);assert.ok(G.isValid(c.get(GAME)));
});
test('추천은 실행하지 않고 출발·도착을 표시, 잘못된 응답은 재검사',()=>{
 const b=browser({hash:'#daily'}),before=b.get(GAME);b.click('hint-btn');b.advance(30);b.workers[0].reply({from:0,to:0});
 const after=b.get(GAME),move=G.matingMoves(after)[0];assert.deepEqual(after.board,before.board);assert.equal(after.hintsUsed,1);
 assert.ok(point(b,move.to).classList.contains('hint-to'));assert.equal(point(b,move.from).attributes['aria-selected'],'true');assert.equal(b.document.activeElement,point(b,move.from));
 point(b,move.to).fire('click');assert.equal(b.element('result-screen').hidden,false);
});
test('한 수 외통 실패·무르기·정답·출석·통계는 한 번 기록',()=>{
 const b=browser({hash:'#daily'}),initial=b.get(GAME),correct=G.matingMoves(initial),wrong=G.legalMoves(initial).find(a=>!correct.some(m=>G.sameAction(a,m)));
 assert.ok(wrong);play(b,wrong);assert.equal(b.get(GAME).puzzleAttempted,true);assert.equal(b.workers.length,0);assert.match(b.element('game-status').textContent,/외통이 아니/);
 b.click('undo-btn');play(b,G.matingMoves(b.get(GAME))[0]);assert.equal(b.element('result-screen').hidden,false);assert.equal(b.get(GAME),null);assert.equal(b.get(STATS).daily.wins,1);
 assert.equal(b.get(DAILY).attempts,2);assert.ok(b.get('maeil-game.daily.v1').done['2026-11-23'].includes('janggi'));
 b.window.fire('pagehide');b.click('undo-btn');assert.equal(b.get(STATS).daily.played,1);b.click('again-btn');assert.deepEqual(b.get(GAME).board,initial.board);
});
test('두 번 한 수 쉼은 점수로 종료하고 기권은 재확인',()=>{
 const b=browser();b.click('start-btn');b.click('pass-btn');b.advance(260);b.workers[0].reply({pass:true});
 assert.equal(b.element('result-screen').hidden,false);assert.match(b.element('result-sub').textContent,/서로 한 수 쉼/);assert.equal(b.get(STATS).medium.wins,0);
 const c=browser();c.click('start-btn');c.click('resign-btn');assert.equal(c.element('result-screen').hidden,true);c.advance(5100);assert.equal(c.element('resign-btn').textContent,'기권');
 c.click('resign-btn');c.click('resign-btn');assert.equal(c.element('result-screen').hidden,false);assert.equal(c.get(STATS).medium.played,1);
});
test('한자·판 확대·큰 글씨·화면 회전은 대국·선택을 바꾸지 않음',()=>{
 const b=browser();b.click('start-btn');point(b,54).fire('click');const before=b.get(GAME);
 b.click('script-btn');assert.equal(point(b,76).textContent,'초');
 const c=browser({saved:{'maeil-game.janggi.display.v1':b.get('maeil-game.janggi.display.v1')}});c.click('start-btn');assert.equal(point(c,76).textContent,'초');b.click('zoom-btn');assert.equal(b.element('board-scroll').classList.contains('zoomed'),true);
 b.document.querySelectorAll('.large-text-toggle')[0].fire('click');b.document.querySelectorAll('.dark-toggle')[0].fire('click');b.window.fire('resize');
 assert.deepEqual(b.get(GAME),before);assert.equal(point(b,54).attributes['aria-selected'],'true');
});
test('키보드 방향키·확인키·반복키 보호와 Escape 선택 취소',()=>{
 const b=browser();b.click('start-btn');b.key('Enter',point(b,54));assert.equal(point(b,54).attributes['aria-selected'],'true');
 b.key('ArrowUp',point(b,54));b.document.fire('keydown',{key:'Enter',target:point(b,45),repeat:true});assert.equal(b.get(GAME).actions.length,0);
 b.key('Enter',point(b,45));assert.equal(b.get(GAME).actions.length,1);
 const c=browser();c.click('start-btn');let prevented=false;c.document.fire('keydown',{key:'Enter',target:c.element('pass-btn'),repeat:true,preventDefault(){prevented=true;}});assert.ok(prevented);point(c,54).fire('click');c.key('Escape');assert.equal(c.element('clear-pick-btn').disabled,true);c.key('Escape');assert.equal(c.element('pause-overlay').hidden,false);
});
test('이전 날짜 완료는 최신 오늘 기록을 보존, 손상 저장 무시·저장 차단 완주',()=>{
 const old=G.create('medium',{daily:'2026-11-22'}),latest={date:'2026-11-23',hints:0,attempts:1,seconds:10};
 const b=browser({saved:{[GAME]:old,[DAILY]:latest}});b.click('continue-btn');play(b,G.matingMoves(old)[0]);assert.deepEqual(b.get(DAILY),latest);
 const bad=browser({saved:{[GAME]:{board:[]},[STATS]:'손상'}});assert.equal(bad.element('continue-wrap').hidden,true);bad.click('start-btn');assert.ok(G.isValid(bad.get(GAME)));
 const c=browser({blockedStorage:true,hash:'#daily'});play(c,G.matingMoves(G.create('medium',{daily:'2026-11-23'}))[0]);assert.equal(c.element('result-screen').hidden,false);
});
