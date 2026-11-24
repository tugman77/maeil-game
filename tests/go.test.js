const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../go/js/logic.js'),AI=require('../go/js/ai.js');
const position=(black=[],white=[],turn=1)=>{const p=G.create();black.forEach(i=>p.board[i]=1);white.forEach(i=>p.board[i]=-1);p.turn=turn;p.keys=[G.key(p.board)];return p;};
function oracle(p,at){
  if(at<0||at>=81||p.board[at])return null;const b=p.board.slice();b[at]=p.turn;
  const adjacent=i=>{const x=i%9,y=(i/9)|0;return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([x,y])=>x>=0&&x<9&&y>=0&&y<9).map(([x,y])=>y*9+x);};
  const collect=start=>{const stones=new Set([start]),libs=new Set();let prior=0;while(prior!==stones.size){prior=stones.size;for(const i of [...stones])for(const n of adjacent(i))if(!b[n])libs.add(n);else if(b[n]===b[start])stones.add(n);}return {stones:[...stones],libs:[...libs]};};
  const remove=new Set();for(let i=0;i<81;i++)if(b[i]===-p.turn){const g=collect(i);if(!g.libs.length)g.stones.forEach(n=>remove.add(n));}remove.forEach(i=>b[i]=0);
  if(!collect(at).libs.length||p.keys.includes(G.key(b)))return null;return {board:b,captured:[...remove].sort((a,b)=>a-b)};
}
test('9줄 초기 상태·난이도·흑 선공·상하좌우 연결과 공유 활로',()=>{
 const p=G.create();assert.ok(G.isValid(p));assert.equal(G.legalMoves(p).length,81);assert.equal(p.turn,1);
 const b=position([0,1,10],[9]).board;assert.deepEqual(G.group(b,0).stones.sort((a,b)=>a-b),[0,1,10]);assert.deepEqual(G.group(b,0).liberties.sort((a,b)=>a-b),[2,11,19]);
 assert.equal(G.group(position([0,10]).board,0).stones.length,1);assert.equal(G.create('bad').difficulty,'medium');
});
test('여러 상대 무리를 동시에 잡고 판 원본을 보존',()=>{
 const whites=[31,39,41,49],blacks=[22,30,32,38,48,42,50,58],p=position(blacks,whites),before=JSON.stringify(p),t=G.tryMove(p,40);
 assert.ok(t.ok);assert.deepEqual(t.captured.sort((a,b)=>a-b),whites);assert.equal(JSON.stringify(p),before);assert.equal(t.liberties.length,4);
});
test('자충·점유·범위 금지, 잡은 뒤 활로가 생기는 착수는 허용',()=>{
 assert.equal(G.tryMove(position([],[31,39,41,49]),40).error,'suicide');
 assert.ok(G.tryMove(position([22,30,32],[31,39,41,49]),40).ok);
 const p=position([0]);assert.equal(G.tryMove(p,0).error,'occupied');assert.equal(G.tryMove(p,-1).ok,false);assert.equal(G.tryMove(p,81).ok,false);assert.equal(G.tryMove(p,1.2).ok,false);
});
test('패 즉시 재따기와 오래된 배치 반복 금지, 다른 곳 착수 뒤 패 해소',()=>{
 const p=position([1,9,19],[2,10,12,20]);const t=G.tryMove(p,11);assert.ok(t.ok);assert.deepEqual(t.captured,[10]);
 const q={...p,board:t.board,turn:-1,keys:[...p.keys,G.key(t.board)]};assert.equal(G.tryMove(q,10).error,'repeat');
 const k=G.tryMove(q,80);assert.ok(k.ok);const q2={...q,board:k.board,turn:1,keys:[...q.keys,G.key(k.board)]},l=G.tryMove(q2,79);
 const q3={...q2,board:l.board,turn:-1,keys:[...q2.keys,G.key(l.board)]};assert.ok(G.tryMove(q3,10).ok);
 const old=G.tryMove(G.create(),40);assert.equal(G.tryMove({...G.create(),keys:[G.key(old.board),'other']},40).error,'repeat');
});
test('영역 계가: 돌+빈 점, 중립·백 덤, 잡은 돌 이중 가산 없음',()=>{
 const empty=G.score(Array(81).fill(0));assert.equal(empty.black,0);assert.equal(empty.white,6.5);assert.equal(empty.neutral,81);
 const b=Array(81).fill(0);for(let y=0;y<9;y++){b[y*9+3]=1;b[y*9+5]=-1;}
 const s=G.score(b);assert.equal(s.black,36);assert.equal(s.white,42.5);assert.equal(s.neutral,9);assert.equal(s.black+s.whiteArea+s.neutral,81);
 const p=position([0],[1]),before=p.board.slice(),a=G.score(p.board,[1]);assert.equal(a.black,81);assert.equal(a.white,6.5);assert.deepEqual(p.board,before);
});
test('두 번 쉼·죽은 무리 전체 표시/취소·계속 두기·계가 확정',()=>{
 const p=G.create();[0,80,1,79].forEach(at=>assert.ok(G.move(p,{at})));G.move(p,{pass:true});G.move(p,{pass:true});
 assert.equal(p.phase,'scoring');assert.equal(G.move(p,{at:40}),false);assert.ok(G.toggleDead(p,80));assert.deepEqual(p.dead,[79,80]);assert.ok(G.isValid(p));
 assert.equal(G.move(p,{score:[80]}),false);G.toggleDead(p,79);assert.deepEqual(p.dead,[]);
 G.toggleDead(p,80);assert.ok(G.move(p,{resume:true}));assert.equal(p.phase,'play');assert.equal(p.turn,1);assert.equal(p.passes,0);assert.deepEqual(p.dead,[]);assert.ok(G.isValid(p));
 G.move(p,{pass:true});G.move(p,{pass:true});G.toggleDead(p,80);assert.ok(G.move(p,{score:p.dead}));assert.ok(p.over);assert.equal(p.reason,'score');assert.equal(p.winner,1);assert.ok(G.isValid(p));assert.equal(G.move(p,{pass:true}),false);
});
test('한 차례 무르기: AI 응수·쉼·슈퍼코 이력 복원과 기권',()=>{
 const p=G.create(),initial=structuredClone(p);G.move(p,{at:40});G.move(p,{at:20});p.hintsUsed=2;p.elapsed=5;
 assert.ok(G.undo(p));assert.deepEqual(p.board,initial.board);assert.deepEqual(p.keys,initial.keys);assert.equal(p.turn,1);assert.equal(p.hintsUsed,2);assert.equal(p.elapsed,5);assert.equal(p.undoUsed,1);assert.ok(G.isValid(p));
 G.move(p,{pass:true});G.move(p,{pass:true});assert.ok(G.undo(p));assert.equal(p.phase,'play');assert.equal(p.actions.length,0);
 G.move(p,{resign:true});assert.ok(p.over);assert.equal(p.winner,-1);assert.equal(G.canUndo(p),false);assert.ok(G.isValid(p));
});
test('1,000일 같은 판 재현·백돌 단수·한 수 정답과 실패 후 재도전',()=>{
 const variants=new Set();for(let j=0;j<1000;j++){
  const day=new Date(Date.UTC(2026,0,1+j)).toISOString().slice(0,10),p=G.create('medium',{daily:day});assert.ok(G.isValid(p));assert.deepEqual(p,G.create('medium',{daily:day}));variants.add(G.key(p.board));
  assert.equal(G.group(p.board,p.targets[0]).liberties.length,1);const moves=G.puzzleMoves(p);assert.equal(moves.length,1);assert.ok(oracle(p,moves[0]));
  assert.ok(G.move(p,{at:moves[0]}));assert.ok(p.over);assert.equal(p.winner,1);assert.ok(G.isValid(p));
 }
 assert.ok(variants.size>100);
 const p=G.create('medium',{daily:'2026-11-25'}),answer=G.puzzleMoves(p)[0],wrong=G.legalMoves(p).find(at=>at!==answer);
 G.move(p,{at:wrong});assert.equal(p.attempted,true);assert.equal(G.move(p,{at:answer}),false);assert.ok(G.undo(p));G.move(p,{at:answer});assert.equal(p.attempts,2);assert.ok(G.isValid(p));
});
test('저장 검증: 판·차례·반복 이력·포획·행동·사석 일부 조작 거부',()=>{
 const p=G.create();G.move(p,{at:40});G.move(p,{at:20});assert.ok(G.isValid(p));
 for(const mutate of [q=>q.board[0]=1,q=>q.turn=-1,q=>q.keys=[],q=>q.captures.black=9,q=>q.actions[0].at=20,q=>q.undoMarks=[5],q=>q.dead=[40],q=>q.elapsed=-1,q=>q.hintsUsed=.5,q=>q.version=3]){const q=structuredClone(p);mutate(q);assert.equal(G.isValid(q),false);}
});
test('독립 규칙 구현과 6,000개 이상 착수·포획 비교',()=>{
 let seed=20261125;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};let checked=0;
 for(let run=0;run<4;run++){
  const p=G.create();for(let step=0;step<36;step++){
   const moves=[];for(let at=0;at<81;at++){
    const a=G.tryMove(p,at),b=oracle(p,at);assert.equal(a.ok,!!b);if(b){assert.deepEqual(a.board,b.board);assert.deepEqual(a.captured.slice().sort((a,b)=>a-b),b.captured);moves.push(at);}checked++;
   }
   if(!moves.length)break;G.move(p,{at:moves[Math.floor(random()*moves.length)]});assert.ok(G.isValid(p));
  }
 }
 assert.ok(checked>6000);
});
test('컴퓨터 합법·결정적 응수·원본 보존, 잡기·단수 탈출·자기 눈 보존',()=>{
 const capture=position([1,9,19],[2,10,12,20]);assert.deepEqual(AI.chooseMove(capture,{samples:0}),{at:11});
 const rescue=position([40],[31,39,41]);assert.equal(AI.chooseMove(rescue,{samples:0}).at,49);
 const eyes=position([1,9,10,11,19]);assert.ok(AI.eye(eyes.board,0,1));assert.notEqual(AI.chooseMove(eyes,{samples:0}).at,0);
 for(const samples of [0,4,12]){const p=G.create(),before=JSON.stringify(p),m=AI.chooseMove(p,{samples});assert.ok(G.tryMove(p,m.at).ok);assert.deepEqual(m,AI.chooseMove(p,{samples}));assert.equal(JSON.stringify(p),before);}
 const p=G.create('medium',{daily:'2026-11-25'});assert.deepEqual(AI.chooseMove(p),{at:G.puzzleMoves(p)[0]});
});
