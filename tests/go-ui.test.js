// 실제 core/start/logic/ai/ui. CSS 렌더링·실기기 터치는 별도 검수 대상.
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../go/js/logic.js'),AI=require('../go/js/ai.js'),dom=require('./helpers/game-dom.js');
const GAME='maeil-game.go.game.v1',STATS='maeil-game.go.stats.v1',DAILY='maeil-game.go.daily.v1';
const browser=options=>dom('go',options),point=(b,i)=>b.element('board').children[i];
const place=(b,i)=>{point(b,i).fire('click');b.click('place-btn');};
const reply=w=>w.reply(AI.chooseMove(w.data.state,{samples:0}));
test('81점·흑 선공·미리보기·다른 점·재누르기 취소 후 명시적 확정',()=>{
 const b=browser();b.click('start-btn');const before=b.get(GAME);assert.ok(G.isValid(before));assert.equal(b.element('board').children.length,81);
 point(b,40).fire('click');assert.equal(point(b,40).attributes['aria-selected'],'true');assert.equal(b.element('place-btn').disabled,false);assert.deepEqual(b.get(GAME),before);
 point(b,41).fire('click');assert.equal(point(b,40).attributes['aria-selected'],'false');point(b,41).fire('click');assert.equal(b.element('place-btn').disabled,true);
 place(b,40);assert.equal(b.get(GAME).board[40],1);assert.equal(b.get(GAME).turn,-1);assert.equal(b.element('place-btn').disabled,true);
 b.advance(260);reply(b.workers[0]);assert.equal(b.get(GAME).turn,1);assert.equal(b.get(GAME).actions.length,2);assert.ok(G.isValid(b.get(GAME)));
});
test('무르기는 컴퓨터 응수와 반복 이력까지 복원하고 늦은 응답 폐기',()=>{
 const b=browser();b.click('start-btn');const before=b.get(GAME);place(b,40);b.advance(260);const w=b.workers[0];b.click('undo-btn');const restored=b.get(GAME);
 assert.equal(w.terminated,true);reply(w);assert.deepEqual(b.get(GAME),restored);assert.deepEqual(restored.board,before.board);assert.deepEqual(restored.keys,before.keys);assert.equal(restored.turn,1);
 place(b,40);b.advance(260);reply(b.workers[1]);b.click('undo-btn');assert.deepEqual(b.get(GAME).board,before.board);assert.equal(b.get(GAME).undoUsed,2);
});
test('처음 화면·이어하기는 컴퓨터 차례를 이어 계산, 과거 Worker 무시',()=>{
 const b=browser();b.click('start-btn');place(b,40);b.advance(260);const w=b.workers[0];b.click('home-btn');const saved=b.get(GAME);reply(w);assert.deepEqual(b.get(GAME),saved);
 assert.equal(b.element('continue-wrap').hidden,false);b.click('continue-btn');b.advance(260);reply(b.workers[1]);assert.equal(b.get(GAME).turn,1);assert.ok(G.isValid(b.get(GAME)));
});
test('일시정지·탭 숨김·bfcache·재접속 보존과 시간 중단',()=>{
 const b=browser();b.click('start-btn');place(b,40);b.advance(1200);b.click('pause-btn');const p=b.get(GAME);b.advance(8000);reply(b.workers[0]);assert.deepEqual(b.get(GAME),p);
 b.click('resume-btn');b.advance(260);reply(b.workers[1]);b.document.hidden=true;b.document.fire('visibilitychange');assert.equal(b.element('pause-overlay').hidden,false);
 const c=browser({saved:{[GAME]:b.get(GAME)}});c.click('continue-btn');assert.deepEqual(c.get(GAME).board,b.get(GAME).board);c.window.fire('pagehide');c.window.fire('pageshow',{persisted:true});assert.equal(c.element('pause-overlay').hidden,false);
});
test('Worker 없음·오류·시간 초과·불법 답변은 합법 응수로 대체',()=>{
 const a=browser({workers:false});a.click('start-btn');place(a,40);a.advance(340);assert.equal(a.get(GAME).turn,1);assert.ok(G.isValid(a.get(GAME)));
 const b=browser();b.click('start-btn');place(b,40);b.advance(260);b.workers[0].onmessage({data:{id:b.workers[0].data.id,error:true}});b.advance(30);assert.equal(b.get(GAME).turn,1);
 const c=browser();c.click('start-btn');place(c,40);c.advance(6400);assert.equal(c.workers[0].terminated,true);assert.equal(c.get(GAME).turn,1);
 const d=browser();d.click('start-btn');place(d,40);d.advance(260);d.workers[0].reply({at:40});assert.equal(d.get(GAME).turn,1);assert.ok(G.isValid(d.get(GAME)));
});
test('추천은 미리보기만 표시, 오늘 문제의 잘못된 Worker 답변 재검증',()=>{
 const b=browser({hash:'#daily'}),before=b.get(GAME),answer=G.puzzleMoves(before)[0];b.click('hint-btn');b.advance(30);b.workers[0].reply({at:-1});
 assert.deepEqual(b.get(GAME).board,before.board);assert.equal(b.get(GAME).hintsUsed,1);assert.ok(point(b,answer).classList.contains('hinted'));assert.equal(b.document.activeElement,point(b,answer));
 b.click('place-btn');assert.equal(b.element('result-screen').hidden,false);
});
test('문제 실패·무르기·정답·출석과 통계 단일 기록, 정답 위치 공유 제외',()=>{
 const b=browser({hash:'#daily'}),initial=b.get(GAME),answer=G.puzzleMoves(initial)[0],wrong=G.legalMoves(initial).find(at=>at!==answer);place(b,wrong);
 assert.equal(b.get(GAME).attempted,true);assert.equal(b.workers.length,0);assert.equal(b.element('place-btn').disabled,true);b.click('undo-btn');place(b,answer);
 assert.equal(b.element('result-screen').hidden,false);assert.equal(b.get(GAME),null);assert.equal(b.get(STATS).daily.wins,1);assert.equal(b.get(DAILY).attempts,2);
 assert.ok(b.get('maeil-game.daily.v1').done['2026-11-23'].includes('go'));b.click('undo-btn');b.window.fire('pagehide');assert.equal(b.get(STATS).daily.played,1);
 b.click('again-btn');assert.deepEqual(b.get(GAME).board,initial.board);
});
function scoringGame(){const p=G.create();[0,80,1,79].forEach(at=>G.move(p,{at}));G.move(p,{pass:true});G.move(p,{pass:true});return p;}
test('계가: 죽은 무리 표시·저장 이어하기·표시 지우기·확정',()=>{
 const b=browser({saved:{[GAME]:scoringGame()}});b.click('continue-btn');assert.equal(b.element('scoring-panel').hidden,false);assert.equal(b.workers.length,0);
 point(b,80).fire('click');assert.deepEqual(b.get(GAME).dead,[79,80]);assert.ok(point(b,79).classList.contains('dead'));assert.match(b.element('score-preview').textContent,/흑 81점/);
 const c=browser({saved:{[GAME]:b.get(GAME)}});c.click('continue-btn');assert.deepEqual(c.get(GAME).dead,[79,80]);c.click('reset-dead-btn');assert.deepEqual(c.get(GAME).dead,[]);
 point(c,80).fire('click');c.click('confirm-score-btn');assert.equal(c.element('result-screen').hidden,false);assert.equal(c.get(GAME),null);assert.match(c.element('result-score').textContent,/81 : 6.5/);assert.equal(c.get(STATS).medium.wins,1);
});
test('계가 계속 두기·무르기와 양쪽 연속 쉼은 확정 전까지 결과 미기록',()=>{
 const b=browser();b.click('start-btn');b.click('pass-btn');b.advance(260);b.workers[0].reply({pass:true});
 assert.equal(b.element('scoring-panel').hidden,false);assert.equal(b.element('result-screen').hidden,true);assert.equal(b.get(STATS),null);
 b.click('resume-play-btn');assert.equal(b.get(GAME).phase,'play');assert.equal(b.get(GAME).turn,1);assert.equal(b.element('scoring-panel').hidden,true);
 b.click('undo-btn');assert.equal(b.get(GAME).actions.length,0);assert.ok(G.isValid(b.get(GAME)));
});
test('확대·큰 글씨·다크 모드·회전은 선택과 진행 유지, 키보드 반복 보호',()=>{
 const b=browser();b.click('start-btn');point(b,40).fire('click');const before=b.get(GAME);b.click('zoom-btn');assert.ok(b.element('board-scroll').classList.contains('zoomed'));
 b.document.querySelectorAll('.large-text-toggle')[0].fire('click');b.document.querySelectorAll('.dark-toggle')[0].fire('click');b.window.fire('resize');assert.deepEqual(b.get(GAME),before);assert.equal(point(b,40).attributes['aria-selected'],'true');
 b.key('ArrowRight',point(b,40));b.key('Enter',point(b,41));assert.equal(point(b,41).attributes['aria-selected'],'true');assert.equal(b.get(GAME).actions.length,0);
 let blocked=false;b.document.fire('keydown',{key:'Enter',target:b.element('place-btn'),repeat:true,preventDefault(){blocked=true;}});assert.ok(blocked);b.key('Escape');assert.equal(b.element('place-btn').disabled,true);b.key('Escape');assert.equal(b.element('pause-overlay').hidden,false);
});
test('기권은 두 번 확인, 끝난 결과는 되돌리거나 중복 기록하지 않음',()=>{
 const b=browser();b.click('start-btn');b.click('resign-btn');assert.equal(b.element('result-screen').hidden,true);b.advance(5100);assert.equal(b.element('resign-btn').textContent,'기권');b.click('resign-btn');b.click('resign-btn');
 assert.equal(b.element('result-score').textContent,'백 불계승');assert.equal(b.get(STATS).medium.played,1);b.click('undo-btn');b.window.fire('pagehide');assert.equal(b.get(STATS).medium.played,1);
});
test('과거 날짜는 최신 기록 보존, 손상 저장 무시·저장 차단 상태도 완주',()=>{
 const p=G.create('medium',{daily:'2026-11-22'}),latest={date:'2026-11-23',hints:0,attempts:1};
 const b=browser({saved:{[GAME]:p,[DAILY]:latest}});b.click('continue-btn');place(b,G.puzzleMoves(p)[0]);assert.deepEqual(b.get(DAILY),latest);
 const c=browser({saved:{[GAME]:{board:[]},[STATS]:'손상'}});assert.equal(c.element('continue-wrap').hidden,true);c.click('start-btn');assert.ok(G.isValid(c.get(GAME)));
 const d=browser({blockedStorage:true,hash:'#daily'});place(d,G.puzzleMoves(G.create('medium',{daily:'2026-11-23'}))[0]);assert.equal(d.element('result-screen').hidden,false);
});
