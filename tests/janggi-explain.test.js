const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../janggi/js/logic'),AI=require('../janggi/js/ai'),dom=require('./helpers/game-dom');
const KEY='maeil-game.janggi.game.v1',STATS='maeil-game.janggi.stats.v1';
const clone=s=>JSON.parse(JSON.stringify(s)),point=(b,i)=>b.element('board').children[i];
function position(pairs,turn=-1){const b=Array(90).fill(0);pairs.forEach(([i,v])=>b[i]=v);return G.adjudicate({...G.position(b,true),turn,over:false});}
const mates=[
 [[4,-1],[7,3],[12,7],[32,3],[42,7],[76,1]],
 [[1,4],[2,3],[4,-1],[23,7],[33,7],[76,1]],
 [[4,-1],[11,5],[16,7],[21,3],[24,7],[76,1]],
 [[2,3],[4,-1],[5,7],[14,7],[19,6],[76,1]],
 [[4,-1],[13,7],[15,3],[30,7],[45,7],[76,1]],
];
function daily(){const b=dom('janggi',{hash:'#daily'}),s=b.get(KEY),a=G.matingMoves(s)[0];point(b,a.from).fire('click');point(b,a.to).fire('click');return {b,s,a};}
function respond(w,report){w.onmessage({data:{id:w.data.id,move:report.move,report}});}
test('외통 5기물·양쪽: 공격 말과 모든 탈출 불가 사유를 현재 판에서 계산',()=>{
 for(const pairs of mates)for(const flip of [false,true]){
  let p=position(pairs);if(flip)p=G.adjudicate({...G.position(p.board.slice().reverse().map(v=>v?-v:0),true),turn:1,over:false});
  const before=clone(p),e=G.mateExplanation(p);assert.ok(e.mate);assert.ok(e.attackers.length);assert.ok(e.escapes.length);
  assert.equal(p.board[e.king],p.turn*G.K);assert.ok(e.escapes.every(e=>e.reason!=='safe'));
  for(const from of e.attackers)assert.ok(G.pseudoMoves(p.board,from).includes(e.king));
  for(const exit of e.escapes.filter(e=>e.reason==='attack')){
   const b=p.board.slice();b[e.king]=0;b[exit.to]=p.turn*G.K;
   assert.ok(exit.attackers.every(i=>G.pseudoMoves(b,i).includes(exit.to)));
  }
  assert.match(e.text,/장군했고.*피할 곳.*외통으로/);assert.match(e.detail,/막거나.*잡아/);assert.deepEqual(p,before);
 }
});
test('자기 말 막힘·잡을 수 있는 공격 말·궁 이동으로 열리는 공격 길 구별',()=>{
 const p=position([[4,-1],[3,-2],[22,3],[76,1]]),e=G.mateExplanation(p);
 assert.equal(e.escapes.find(e=>e.to===3).reason,'own');
 // Rook below the king also attacks the square behind the king once it moves.
 assert.equal(e.escapes.find(e=>e.to===13).reason,'attack');
 const q=position([[4,-1],[13,3],[76,1]]),f=G.mateExplanation(q);
 assert.equal(f.escapes.find(e=>e.to===13).reason,'safe');assert.equal(f.mate,false);
});
test('차·궁 대각선·포 다리·마 멱·상 두 경유점 공격 경로',()=>{
 for(const [from,to,piece,expected] of [[32,5,3,[32,23,14,5]],[3,23,3,[3,13,23]],[1,4,4,[1,2,3,4]],[11,4,5,[11,12,4]],[19,4,6,[19,20,12,4]]]){
  const b=Array(90).fill(0);b[from]=piece;assert.deepEqual(G.attackPath(b,from,to),expected);
 }
});
test('확정 수순은 같은 탐색의 실제 합법 수·최종 외통이고 양쪽 공격을 지원',()=>{
 for(const flip of [false,true]){
  const root=position([[4,-1],[23,7],[29,7],[32,3],[76,1]],1);
  const p=flip?{...G.position(root.board.slice().reverse().map(v=>v?-v:0),true),turn:-1}:root;
  p.kind='match';p.difficulty='hard';const before=clone(p),r=AI.analyze(p,{depth:3,nodes:10000,timeMs:1000});
  assert.equal(r.forced.winner,p.turn);assert.equal(r.forced.plies,3);assert.equal(r.proof.steps.length,3);
  const frames=G.proofPositions(p,r.proof.steps,r.forced.winner);assert.ok(frames);assert.ok(G.mateExplanation(frames.at(-1)).mate);
  assert.deepEqual(p,before);assert.equal(G.proofPositions(p,[{from:0,to:0}],p.turn),null);
  const losing={...frames[1],kind:'match',difficulty:'hard'},loss=AI.analyze(losing,{depth:3,nodes:10000,timeMs:1000});
  assert.ok(G.proofPositions(losing,loss.proof.steps,loss.forced.winner));
 }
});
test('결과 설명: 빅장·연속 쉼·200수·반복을 점수와 구별, 한 덤 포함',()=>{
 for(const [reason,pattern] of [['bikjang',/마주본 빅장.*응수/],['passes',/연속으로 한 수씩/],['limit',/200수/],['repetition',/네 번째.*반복 패배/]]){
  const e=G.resultExplanation({...G.create(),over:true,reason,winner:1});assert.match(e.text,pattern);
  assert.deepEqual(e.scores,{cho:72,han:73.5});assert.match(e.scoreText,/초 72점.*한 73.5점.*1.5점 차이.*덤 1.5/);
 }
});
test('실제 대국 복기: 처음 배치·이동·잡기·쉼·기권 포함, 원본과 저장 보존',()=>{
 const s=G.create();for(const a of [{from:54,to:45},{from:27,to:36},{from:45,to:36},{pass:true}])assert.ok(G.move(s,a));G.resign(s);
 const before=clone(s);assert.deepEqual(G.historyAt(s,0).board,s.initial);assert.equal(G.historyAt(s,3).board[36],G.P);
 assert.equal(G.historyAt(s,4).last.pass,true);assert.equal(G.historyAt(s,5).reason,'resign');assert.equal(G.historyAt(s,6),null);assert.deepEqual(s,before);
 const old=clone(s);delete old.actions.at(-1).side;assert.ok(G.isValid(old));assert.equal(G.historyAt(old,5).winner,-1);
});
test('외통 문제: 판 먼저·표시·큰 결과 버튼·같은 이유·복기 왕복과 기록 1회',()=>{
 const {b,s,a}=daily(),mate=G.advance(s,a),e=G.mateExplanation(mate);
 assert.equal(b.element('game-screen').hidden,false);assert.equal(b.element('result-screen').hidden,true);b.advance(2100);assert.equal(b.element('result-screen').hidden,true);
 assert.equal(b.element('view-result').hidden,false);assert.equal(b.element('board-legend').hidden,false);
 assert.ok(point(b,e.king).classList.contains('explain-king'));assert.ok(e.attackers.every(i=>point(b,i).classList.contains('explain-attacker')));
 assert.equal(b.element('attack-lines').children.length,e.paths.length*2);assert.match(b.element('escape-reasons').textContent,/지켜요/);
 assert.equal(b.get(KEY),null);const stats=b.get(STATS);assert.equal(stats.daily.played,1);
 const text=b.element('outcome-notice').textContent;b.click('view-result');assert.equal(b.element('result-reason').textContent,text);
 b.click('review-board');assert.equal(b.element('game-screen').hidden,false);b.click('view-result');b.click('review-game');
 assert.match(b.element('replay-status').textContent,/0 \/ 1.*시작 판/);assert.equal(b.element('replay-prev').disabled,true);
 b.click('replay-next');assert.match(b.element('replay-status').textContent,/1 \/ 1.*외통/);assert.equal(b.element('replay-next').disabled,true);
 assert.ok(point(b,a.to).textContent.includes('1'));b.click('replay-prev');assert.equal(b.element('attack-lines').children.length,0);
 b.click('replay-close');b.click('view-result');b.window.fire('pagehide');assert.deepEqual(b.get(STATS),stats);
});
test('점수 종료도 판 옆에 이유·점수·차이, 실제 쉼 재생',()=>{
 const b=dom('janggi');b.click('start-btn');b.click('pass-btn');b.advance(140);b.workers[0].reply({pass:true});
 assert.equal(b.element('result-screen').hidden,true);assert.match(b.element('outcome-notice').textContent,/연속으로 한 수씩/);
 assert.match(b.element('score-values').textContent,/72점.*73.5점.*1.5점 차이/);b.click('view-result');b.click('review-game');b.click('replay-next');assert.match(b.element('replay-status').textContent,/한 수 쉼/);
 b.click('replay-next');assert.equal(b.element('replay-next').disabled,true);
});
test('옛 외통 누락 저장도 복원 뒤 판 먼저, 한글·큰 글씨·다크 변경 시 설명 유지',()=>{
 const s=G.create('medium',{daily:'2026-11-25'});G.move(s,G.matingMoves(s)[0]);s.over=false;s.winner=0;s.reason='';
 const b=dom('janggi',{saved:{[KEY]:s}});b.click('continue-btn');const text=b.element('outcome-notice').textContent;
 b.click('script-btn');b.document.querySelectorAll('.large-text-toggle')[0].fire('click');b.document.querySelectorAll('.dark-toggle')[0].fire('click');
 assert.equal(b.element('outcome-notice').textContent,text);assert.equal(b.element('result-screen').hidden,true);assert.equal(b.get(STATS).daily.played,1);
});

function proofBrowser(losing){
 const root={...position([[4,-1],[23,7],[29,7],[32,3],[76,1]],1),kind:'match',difficulty:'hard'};
 const r=AI.analyze(root,{depth:3,nodes:10000,timeMs:1000});
 const p=losing?{...G.position(root.board.slice().reverse().map(v=>v?-v:0),true),turn:-1}:G.advance(root,r.move);
 const beforeUI=`const create=Janggi.create;Janggi.create=(...args)=>{const s=create(...args);Object.assign(s,${JSON.stringify(p)});s.initial=s.board.slice();return s;};`;
 const b=dom('janggi',{beforeUI});b.click('start-btn');b.advance(140);const w=b.workers[0];
 const report=AI.analyze(w.data.state,{depth:3,nodes:10000,timeMs:1000});respond(w,report);return {b,report};
}
test('컴퓨터 기권 전에 핵심 말·궁·증명 수순 표시, 처음/끝/이전/다음·기록 보존',()=>{
 const {b,report}=proofBrowser(false),stats=b.get(STATS);
 assert.equal(b.element('result-screen').hidden,true);assert.match(b.element('outcome-notice').textContent,/수 안에 외통: 이렇게 됩니다/);
 assert.ok(b.element('board').children.some(p=>p.classList.contains('explain-attacker')));assert.ok(b.element('board').children.some(p=>p.classList.contains('explain-king')));
 assert.equal(b.element('view-proof').hidden,false);b.click('view-proof');assert.equal(b.element('replay-prev').disabled,true);
 for(let i=0;i<report.proof.steps.length;i++)b.click('replay-next');
 assert.equal(b.element('replay-next').disabled,true);assert.match(b.element('replay-status').textContent,/외통/);assert.ok(b.element('attack-lines').children.length);
 b.click('replay-prev');b.click('replay-close');b.click('view-result');b.click('review-board');assert.deepEqual(b.get(STATS),stats);
});
test('내 패배 확정: 판을 덮지 않는 선택·수순 재생 후 계속 두기·상태 보존',()=>{
 const {b,report}=proofBrowser(true),before=b.get(KEY);
 assert.equal(b.element('outcome-overlay').hidden,false);assert.equal(b.element('play-area').inert,false);assert.equal(b.get(STATS),null);
 b.click('view-proof');assert.equal(b.element('outcome-overlay').hidden,true);
 b.click('replay-next');const a=report.proof.steps[0];assert.ok(point(b,a.to).textContent.includes('1'));
 assert.deepEqual(b.get(KEY),before);assert.equal(b.element('undo-btn').disabled,true);assert.equal(b.element('hint-btn').disabled,true);
 for(let i=1;i<report.proof.steps.length;i++)b.click('replay-next');b.click('replay-close');assert.equal(b.element('outcome-overlay').hidden,false);
 b.click('outcome-continue');assert.equal(b.get(KEY).continueDecided,true);assert.equal(b.element('view-proof').hidden,true);assert.deepEqual(b.get(KEY).board,before.board);
});
