const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../omok/js/logic');
const dom = require('./helpers/game-dom');
const KEY = 'maeil-game.omok.game.v1', STATS = 'maeil-game.omok.stats.v1';
const at = (x,y) => y*13+x;
const copy = s => JSON.parse(JSON.stringify(s));
const four = [3,4,5,6].map(x => [x,6,1]);
const forks = [
  {type:'open-four', pairs:four, blocks:[at(2,6),at(7,6)], words:/열린 4.*양쪽/},
  {type:'double-four', pairs:[[3,6,1],[4,6,1],[6,6,1],[7,6,1],[6,4,1],[6,5,1],[6,8,1]], blocks:[at(5,6),at(6,7)], words:/4-4.*두 곳/},
  {type:'four-three', pairs:[...four,[2,6,2],[5,4,1],[5,5,1]], blocks:[at(7,6)], words:/4-3.*열린 4/},
  {type:'vcf', pairs:[[8,3,2],[3,5,2],[7,5,1],[4,7,2],[5,7,2],[8,7,1],[5,8,1],[9,8,1],[4,9,2],[7,9,2]], blocks:[], words:/연속 4.*수순 보기/},
];
function state(pairs,turn=2) {
  const s=O.create('medium',{seedText:'explain'});
  s.opening=pairs.map(([x,y,c])=>[at(x,y),c]);
  if(turn===2){const n=s.opening.findIndex(([i,c])=>c===1);s.moves=[s.opening[n][0]];s.opening.splice(n,1);}
  s.board=O.replayBoard(s,s.moves.length);assert.ok(O.isValid(s));return s;
}
const point=(b,i)=>b.element('board').children[i];
function reply(b){const w=b.workers.at(-1);const report=O.analyze(w.data.state,{assessOnly:true,timeMs:500});w.onmessage({data:{id:w.data.id,move:report.move,report}});return report;}
function resume(s){const b=dom('omok',{saved:{[KEY]:s}});b.click('continue-btn');b.advance(140);return b;}
function finished(color=1,daily=false){
  const s=O.create('easy',{seedText:'five',daily:daily?'2026-11-23':null});
  // Reproduce an old saved game with a missing terminal flag.
  s.moves=color===1?[at(2,1),0,at(3,1),2,at(4,1),4,at(5,1),6,at(6,1)]
    :[0,at(2,1),2,at(3,1),4,at(4,1),6,at(5,1),8,at(6,1)];
  s.board=O.replayBoard(s,s.moves.length);assert.ok(O.isValid(s));return s;
}

test('이긴 줄: 네 방향·양 색·좌표와 쉬운 방향 문장, 여섯 돌도 보존',()=>{
  for(const [dx,dy,name] of [[1,0,'가로로'],[0,1,'세로로'],[1,1,'대각선으로'],[-1,1,'대각선으로']])for(const color of [1,2]){
    const board=Array(169).fill(0),cells=Array.from({length:5},(_,k)=>at(6+dx*k,2+dy*k));
    cells.forEach(i=>board[i]=color);const line=O.winLine(board,cells[2]);
    assert.deepEqual(new Set(line),new Set(cells));const e=O.explainWin({board,line,moves:[cells[2]]});
    assert.equal(e.text,`${color===1?'흑':'백(컴퓨터)'}이 ${name} 다섯 개를 이었어요 — ${color===1?'내 승리':'내 패배'}`);
  }
  const board=Array(169).fill(0);[1,2,3,4,5,6].forEach(x=>board[at(x,1)]=1);
  assert.equal(O.explainWin({board,moves:[at(3,1)]}).line.length,6);
});

for(const fixture of forks)test(`확정 설명 ${fixture.type}: 색·회전·빈칸 좌표와 증명 수순`,()=>{
  for(const swap of [false,true])for(const rotate of [false,true]){
    const transform=([x,y,c])=>rotate?[12-y,x,swap?3-c:c]:[x,y,swap?3-c:c];
    const s=state(fixture.pairs.map(transform),swap?1:2),before=copy(s),r=O.analyze(s,{assessOnly:true,timeMs:500});
    assert.ok(r.forced);const e=r.explanation;assert.equal(e.type,fixture.type);assert.match(e.text,fixture.words);
    const blocks=fixture.blocks.map(i=>rotate?at(12-Math.floor(i/13),i%13):i);
    assert.deepEqual(new Set(e.blocks),new Set(blocks));e.blocks.concat(e.next).forEach(i=>assert.equal(s.board[i],0));
    assert.ok(e.stones.length>=3);e.stones.forEach(i=>assert.equal(s.board[i],r.forced.winner));
    if(e.type==='four-three')assert.equal(e.next.length,1);
    if(e.type==='vcf')assert.equal(e.next[0],e.steps[0].idx);
    const board=s.board.slice();e.steps.forEach((step,n)=>{
      assert.equal(board[step.idx],0);assert.equal(step.color,(s.moves.length+n)%2?2:1);
      board[step.idx]=step.color;
      if(n===e.steps.length-1)assert.ok(O.winLine(board,step.idx));
      else assert.equal(O.winLine(board,step.idx),null);
    });
    assert.equal(e.steps.at(-1).color,r.forced.winner);assert.deepEqual(s,before);
    if(e.blocks.length>=2)for(const block of e.blocks){const blocked=s.board.slice();blocked[block]=3-e.color;assert.ok(O.winningMoves(blocked,e.color).length);}
  }
});

test('다섯 완성: 빈칸 하나에 바로 두는 증명은 거짓 연속 4로 설명하지 않음',()=>{
 const s=state([...four,[2,6,2]],1),r=O.analyze(s,{assessOnly:true});
 assert.equal(r.explanation.type,'finish-five');assert.deepEqual(r.explanation.blocks,[at(7,6)]);
});

test('반격·공유 빈칸·막힌 4는 잘못된 두 갈래 설명을 만들지 않음',()=>{
 const shared=state([[3,6,1],[4,6,1],[6,6,1],[7,6,1],[5,3,1],[5,4,1],[5,5,1],[5,7,1]]);
 assert.equal(O.analyze(shared,{assessOnly:true}).explanation,undefined);
 const closed=state([[0,0,1],[1,0,1],[2,0,1],[3,0,1],[4,0,2]]);
 assert.equal(O.analyze(closed,{assessOnly:true}).forced,null);
 const counter=state([...forks[2].pairs,...[2,3,4,5].map(x=>[x,1,2])]);
 assert.equal(O.analyze(counter,{assessOnly:true}).explanation.color,2);
});

for(const color of [1,2])test(`실제 ${color===1?'승리':'패배'}: 판 먼저·결과 버튼·같은 이유·돌아오기·기록 한 번`,()=>{
 const s=finished(color),b=dom('omok',{saved:{[KEY]:s}});b.click('continue-btn');
 const reason=b.element('outcome-notice').textContent;assert.match(reason,/가로로 다섯 개.*내/);
 assert.equal(b.element('result-screen').hidden,true);assert.equal(b.element('view-result').hidden,false);
 assert.equal(b.element('board').children.filter(p=>p.classList.contains('win')).length,5);
 assert.match(point(b,s.moves.at(-1)).attributes['aria-label'],/마지막 수.*이긴 줄/);
 assert.notEqual(b.element('board').style['--win-width'],'0px');
 b.advance(5000);assert.equal(b.element('result-screen').hidden,true);
 b.window.fire('pagehide');assert.equal(b.element('result-screen').hidden,true);
 b.click('view-result');assert.equal(b.element('result-reason').textContent,reason);assert.equal(b.element('game-screen').hidden,true);
 b.click('review-board');assert.equal(b.element('game-screen').hidden,false);assert.equal(b.element('outcome-notice').textContent,reason);
 b.click('view-result');assert.equal(b.get(STATS).easy.played,1);assert.equal(b.get(KEY),null);
});

test('컴퓨터 기권도 판 먼저: 두 막을 곳과 돌 강조·결과·승리 기록 한 번',()=>{
 const b=resume(state(four));reply(b);
 assert.equal(b.element('result-screen').hidden,true);assert.equal(b.get(STATS).medium.wins,1);
 for(const i of [at(2,6),at(7,6)])assert.ok(point(b,i).classList.contains('block-point'));
 for(const [x,y] of four)assert.ok(point(b,at(x,y)).classList.contains('threat'));
 b.advance(5000);assert.equal(b.element('result-screen').hidden,true);b.click('view-result');
 assert.match(b.element('result-reason').textContent,/열린 4.*컴퓨터 기권/);
 b.click('review-board');b.click('view-result');assert.equal(b.get(STATS).medium.played,1);
});

test('패배 확정: 판 아래 선택·설명·증명 복기 동안 저장과 재질문 결정 보존',()=>{
 const s=state(forks[2].pairs.map(([x,y,c])=>[x,y,3-c]),1),b=resume(s),report=reply(b),saved=b.get(KEY);
 assert.equal(b.element('outcome-overlay').hidden,false);assert.equal(b.element('game-screen').hidden,false);
 assert.equal(b.element('outcome-detail').textContent,report.explanation.text);
 assert.ok(point(b,at(7,6)).classList.contains('block-point'));
 assert.ok(point(b,report.explanation.next[0]).classList.contains('next-point'));
 b.click('view-proof');assert.equal(b.element('outcome-overlay').hidden,true);b.click('replay-next');
 assert.match(b.element('replay-status').textContent,/1 \/ 4수/);assert.deepEqual(b.get(KEY),saved);
 b.click('replay-close');assert.equal(b.element('outcome-overlay').hidden,false);
 assert.equal(b.element('board').inert,false);assert.equal(point(b,at(7,6)).disabled,true);b.click('outcome-continue');assert.equal(b.get(KEY).continueDecided,true);
 assert.equal(b.element('outcome-overlay').hidden,true);assert.equal(b.element('replay-controls').hidden,true);
});

test('VCF 수순 보기: 번호·이전/다음 경계·끝의 이긴 줄·원래 판과 기록 보존',()=>{
 const b=resume(state(forks[3].pairs.map(([x,y,c])=>[x,y,3-c]),1));const r=reply(b),before=b.get(STATS),count=b.workers.length;
 b.click('view-proof');assert.equal(b.element('replay-prev').disabled,true);
 r.explanation.steps.forEach((step,n)=>{
   b.click('replay-next');const p=point(b,step.idx);
   assert.equal(p.children.at(-1).textContent,String(n+1));
   assert.ok(p.classList.contains(step.color===1?'black':'white'));
 });
 assert.equal(b.element('replay-next').disabled,true);
 assert.equal(b.element('board').children.filter(p=>p.classList.contains('win')).length,5);
 b.click('replay-prev');assert.equal(b.element('replay-next').disabled,false);
 b.click('replay-close');assert.equal(b.element('replay-controls').hidden,true);
 assert.equal(b.workers.length,count);assert.deepEqual(b.get(STATS),before);
});

test('실제 수순 다시 보기: 빈 판/오늘 첫 모양·모든 실제 수·복원·AI/저장/기록 불변',()=>{
 for(const daily of [false,true]){
   const s=finished(1,daily),b=dom('omok',{saved:{[KEY]:s}});b.click('continue-btn');b.click('view-result');
   const stats=b.get(STATS);b.click('review-game');assert.match(b.element('replay-status').textContent,/0 \/ 9수/);
   assert.match(b.element('replay-status').textContent,daily?/미리 놓인 첫 모양/:/빈 판/);
   const base=s.opening.length;
   assert.equal(b.element('board').children.filter(p=>/black|white/.test(p.className)).length,base);
   for(let n=0;n<s.moves.length;n++){
     b.click('replay-next');assert.ok(point(b,s.moves[n]).classList.contains(n%2?'white':'black'));
     assert.equal(b.element('board').children.filter(p=>/black|white/.test(p.className)).length,base+n+1);
   }
   assert.equal(b.element('replay-next').disabled,true);b.click('replay-prev');
   assert.equal(point(b,s.moves.at(-1)).classList.contains('black'),false);
   b.window.fire('pagehide');b.window.fire('pageshow');b.click('replay-close');
   assert.ok(point(b,s.moves.at(-1)).classList.contains('win'));b.click('view-result');
   assert.deepEqual(b.get(STATS),stats);assert.equal(b.get(KEY),null);assert.equal(b.workers.length,0);
 }
});

test('실제 착수 직후에도 승패 이유를 먼저 보며, 무르기·착수와 숨김으로 결과가 바뀌지 않음',()=>{
 for(const color of [1,2]){
  const complete=finished(color),s=copy(complete);s.moves.pop();s.board=O.replayBoard(s,s.moves.length);
  const b=resume(s),w=b.workers.at(-1),last=complete.moves.at(-1);
  // Simulate a search that ran out of proof budget, so actual five is played.
  w.onmessage({data:{id:w.data.id,move:last,report:{forced:null}}});
  if(color===1){b.element('board').fire('click',{target:point(b,last)});b.click('place-btn');}
  assert.equal(b.element('result-screen').hidden,true);assert.ok(point(b,last).classList.contains('last'));
  assert.match(b.element('outcome-notice').textContent,/가로로 다섯 개/);const stats=b.get(STATS);
  b.click('undo-btn');b.click('place-btn');b.window.fire('pagehide');b.advance(3000);
  assert.equal(b.element('result-screen').hidden,true);assert.deepEqual(b.get(STATS),stats);
  b.click('view-result');assert.equal(b.get(STATS).easy.played,1);
 }
});
