const test=require('node:test'),assert=require('node:assert/strict'),dom=require('./helpers/game-dom');
const J=require('../janggi/js/logic'),AI=require('../janggi/js/ai'),O=require('../omok/js/logic');
const JK='maeil-game.janggi.game.v1',JS='maeil-game.janggi.stats.v1',OK='maeil-game.omok.game.v1',OS='maeil-game.omok.stats.v1';
const point=(b,i)=>b.element('board').children[i];
function jplay(b){const a=J.legalMoves(b.get(JK))[0];point(b,a.from).fire('click');point(b,a.to).fire('click');b.advance(140);return b.workers.at(-1);}
function respond(w,report){w.onmessage({data:{id:w.data.id,move:report.move,report,rng:w.data.state.rng}});}
function jreport(w,winner){return {move:AI.chooseMove(w.data.state,{depth:1,nodes:100}),forced:{winner,plies:3}};}
function savedOmok(pairs,turn=2){
 const s=O.create('medium',{seedText:'ui'});s.opening=pairs.map(([x,y,c])=>[y*13+x,c]);
 if(turn===2){const n=s.opening.findIndex(([i,c])=>c===1);s.moves=[s.opening[n][0]];s.opening.splice(n,1);}
 s.opening.forEach(([i,c])=>s.board[i]=c);s.moves.forEach(i=>s.board[i]=1);assert.ok(O.isValid(s));return s;
}
const four=[3,4,5,6].map(x=>[x,6,1]);
test('장기 Worker의 확정 보고: 컴퓨터 기권·승리 기록은 한 번',()=>{
 const b=dom('janggi');b.click('start-btn');const w=jplay(b);respond(w,jreport(w,1));
 assert.equal(b.element('result-screen').hidden,false);assert.match(b.element('result-sub').textContent,/컴퓨터 기권.*2수 안에 외통/);
 assert.equal(b.get(JS).medium.wins,1);assert.equal(b.get(JK),null);respond(w,jreport(w,1));assert.equal(b.get(JS).medium.played,1);
});
test('장기 패배 확정은 선택을 기다림·계속은 한 번만·저장/복원/무르기 보존',()=>{
 const b=dom('janggi');b.click('start-btn');let w=jplay(b);respond(w,jreport(w,-1));
 assert.equal(b.element('outcome-overlay').hidden,false);assert.equal(b.element('play-area').inert,true);assert.equal(b.get(JS),null);
 b.click('outcome-continue');assert.equal(b.get(JK).continueDecided,true);b.advance(140);w=b.workers.at(-1);respond(w,jreport(w,-1));
 assert.equal(b.element('outcome-overlay').hidden,true);assert.equal(b.get(JK).actions.length,2);
 const saved=b.get(JK),c=dom('janggi',{saved:{[JK]:saved}});c.click('continue-btn');c.advance(30);w=c.workers.at(-1);respond(w,jreport(w,-1));assert.equal(c.element('outcome-overlay').hidden,true);
 c.click('undo-btn');assert.equal(c.get(JK).continueDecided,true);assert.equal(c.get(JK).outcomeText,undefined);
});
test('장기 기권하고 새 판: 패배 기록·초기 포진·늦은 응답 차단',()=>{
 const b=dom('janggi');b.click('start-btn');const w=jplay(b);respond(w,jreport(w,-1));b.click('outcome-new');
 assert.equal(b.get(JS).medium.played,1);assert.equal(b.get(JS).medium.wins,0);assert.equal(b.get(JK).actions.length,0);assert.equal(b.element('outcome-overlay').hidden,true);
 respond(w,jreport(w,1));assert.equal(b.get(JS).medium.played,1);
});
test('장기 옛 저장본의 누락 외통은 이어하기 직후 종료·오늘의 문제는 확인창 없음',()=>{
 const s=J.create('medium',{daily:'2026-11-25'});J.move(s,J.matingMoves(s)[0]);s.over=false;s.winner=0;s.reason='';
 const b=dom('janggi',{saved:{[JK]:s}});b.click('continue-btn');assert.equal(b.element('result-screen').hidden,false);assert.equal(b.workers.length,0);assert.equal(b.element('outcome-overlay').hidden,true);
});
test('오목 실제 열린4 증명으로 컴퓨터가 기권·오늘 도전 출석·기록 한 번',()=>{
 const s=savedOmok(four);s.daily='2026-11-23';const b=dom('omok',{saved:{[OK]:s}});b.click('continue-btn');b.advance(140);
 const w=b.workers[0];respond(w,O.analyze(w.data.state));assert.match(b.element('outcome-notice').textContent,/열린 4.*내 승리/);assert.equal(b.get(OK),null);
 b.advance(2000);assert.equal(b.element('result-screen').hidden,true);b.click('view-result');assert.equal(b.element('result-screen').hidden,false);assert.match(b.element('result-sub').textContent,/컴퓨터 기권/);assert.equal(b.get(OS).daily.wins,1);
 assert.ok(b.get('maeil-game.daily.v1').done['2026-11-23'].includes('omok'));respond(w,O.analyze(w.data.state));b.window.fire('pagehide');assert.equal(b.get(OS).daily.played,1);
});
test('오목 백의 강제 승리: 계속 선택 저장과 재질문 방지·기권 새 판',()=>{
 const s=savedOmok([[0,0,1],...[3,4,5,6].map(x=>[x,6,2])],1);
 const b=dom('omok',{saved:{[OK]:s}});b.click('continue-btn'); // opening-only board: analyze on resume must still run
 b.advance(140);const w=b.workers[0];assert.ok(w);respond(w,O.analyze(w.data.state,{assessOnly:true}));
 assert.equal(b.element('outcome-overlay').hidden,false);b.click('outcome-continue');assert.equal(b.get(OK).continueDecided,true);
 const c=dom('omok',{saved:{[OK]:b.get(OK)}});c.click('continue-btn');c.advance(140);respond(c.workers[0],O.analyze(c.workers[0].data.state,{assessOnly:true}));assert.equal(c.element('outcome-overlay').hidden,true);
 const d=dom('omok',{saved:{[OK]:s}});d.click('continue-btn');d.advance(140);respond(d.workers[0],O.analyze(d.workers[0].data.state,{assessOnly:true}));d.click('outcome-new');
 assert.equal(d.get(OS).medium.played,1);assert.equal(d.get(OS).medium.wins,0);assert.equal(d.get(OK).moves.length,0);assert.equal(d.element('outcome-overlay').hidden,true);
});
test('오목 Worker 취소·탭 숨김·늦은 응답 무시·없음/오류/시간초과 대체',()=>{
 const b=dom('omok');b.click('start-btn');b.element('board').fire('click',{target:point(b,84)});b.click('place-btn');b.advance(140);const w=b.workers[0];
 b.document.hidden=true;b.document.fire('visibilitychange');const before=b.get(OK);respond(w,O.analyze(w.data.state));assert.deepEqual(b.get(OK),before);assert.ok(w.terminated);
 b.document.hidden=false;b.document.fire('visibilitychange');b.advance(140);const next=b.workers.at(-1);respond(next,O.analyze(next.data.state,{depth:1,nodes:300,timeMs:60}));assert.equal(b.get(OK).moves.length,2);
 for(const mode of ['none','error','timeout']){
  const c=dom('omok',{workers:mode!=='none'});c.click('start-btn');c.element('board').fire('click',{target:point(c,84)});c.click('place-btn');c.advance(140);
  if(mode==='error')c.workers[0].onmessage({data:{id:c.workers[0].data.id,error:true}});
  c.advance(mode==='timeout'?5600:250);assert.equal(c.get(OK).moves.length,2,mode);assert.ok(O.isValid(c.get(OK)));
 }
});
test('오목 다섯을 만들 수 없는 옛 저장판은 이어하기에서 무승부·기록 중복 없음',()=>{
 const pairs=[];for(let y=0;y<13;y++)for(let x=0;x<13;x++)if(y*13+x!==84)pairs.push([x,y,(x+2*y)%4<2?1:2]);
 const s=savedOmok(pairs,1),b=dom('omok',{saved:{[OK]:s}});b.click('continue-btn');b.advance(800);
 assert.equal(b.element('result-title').textContent,'무승부');assert.equal(b.get(OK),null);assert.equal(b.get(OS).medium.played,1);
 b.window.fire('pagehide');assert.equal(b.get(OS).medium.played,1);
});

test('장기 실제 대국의 20점 차이 6차례 저장을 재생해 컴퓨터 자동 기권',()=>{
 const actions=[{from:62,to:61},{from:0,to:18},{from:89,to:35},{from:7,to:24},{from:35,to:8},{from:25,to:22},{from:8,to:6},{from:29,to:28},{from:6,to:24},{from:13,to:21},{from:24,to:22},{from:21,to:12},{from:22,to:19},{from:31,to:32}];
 const s=J.create();for(const a of actions)assert.ok(J.move(s,a));assert.ok(J.isValid(s));assert.ok(s.leadCount>=6);
 const b=dom('janggi',{saved:{[JK]:s}});b.click('continue-btn');b.advance(30);respond(b.workers[0],{move:null,forced:null});
 assert.equal(b.element('result-screen').hidden,false);assert.match(b.element('result-sub').textContent,/컴퓨터 기권.*크게 유리/);assert.equal(b.get(JS).medium.wins,1);
 const undone=J.restore(s);J.undo(undone);assert.ok(undone.leadCount<6);assert.equal(J.decision(undone,null),null);
});
