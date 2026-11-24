const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../janggi/js/logic.js'),AI=require('../janggi/js/ai.js'),M=require('../common/core.js');
const at=(x,y)=>y*9+x,clone=s=>JSON.parse(JSON.stringify(s));
function bare(){const b=Array(90).fill(0);b[76]=G.K;b[13]=-G.K;b[49]=G.P;return b;}
// 별도 구현: 출발점에서 ray를 생성하지 않고 목적지별 중간 점·경로를 검사한다.
function reference(b,from,to){
 const v=b[from],s=Math.sign(v),t=Math.abs(v);if(!v||from===to||Math.sign(b[to])===s)return false;
 const x=from%9,y=Math.floor(from/9),tx=to%9,ty=Math.floor(to/9),dx=tx-x,dy=ty-y;
 const pal=(x,y,side)=>x>=3&&x<=5&&(side===1?y>=7&&y<=9:y>=0&&y<=2);
 const lines=[[3,13,23],[5,13,21],[66,76,86],[68,76,84]];
 const diagonal=lines.find(line=>line.includes(from)&&line.includes(to));
 if(t===G.K||t===G.A)return pal(tx,ty,s)&&((Math.abs(dx)+Math.abs(dy)===1)||(diagonal&&Math.abs(dx)===1&&Math.abs(dy)===1));
 if(t===G.P)return (dy===0&&Math.abs(dx)===1)||(dx===0&&dy===-s)||(pal(x,y,-s)&&diagonal&&Math.abs(dx)===1&&dy===-s);
 if(t===G.H||t===G.E){
  for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]])for(const turn of [-1,1]){
   const ax=ox||turn,ay=oy||turn,first=[x+ox,y+oy],second=[first[0]+ax,first[1]+ay],last=t===G.H?second:[second[0]+ax,second[1]+ay];
   if(last[0]===tx&&last[1]===ty&&!b[at(...first)]&&(t===G.H||!b[at(...second)]))return true;
  }return false;
 }
 if(t===G.R||t===G.C){
  let middle=[];
  if(dx===0||dy===0){const sx=Math.sign(dx),sy=Math.sign(dy);for(let i=1;i<Math.max(Math.abs(dx),Math.abs(dy));i++)middle.push(at(x+sx*i,y+sy*i));}
  else if(diagonal){const a=diagonal.indexOf(from),z=diagonal.indexOf(to);middle=diagonal.slice(Math.min(a,z)+1,Math.max(a,z));}
  else return false;
  const blockers=middle.map(i=>b[i]).filter(Boolean);
  return t===G.R?!blockers.length:blockers.length===1&&Math.abs(blockers[0])!==G.C&&Math.abs(b[to])!==G.C;
 }
 return false;
}
function referenceCheck(b,s){const k=b.indexOf(s*G.K);return k<0||b.some((v,i)=>Math.sign(v)===-s&&reference(b,i,k));}
test('초기 32기물·궁 위치·포진 4개·점수·합법 수',()=>{
 for(let f=0;f<4;f++){const s=G.create('medium',{formation:f});assert.ok(G.isValid(s));assert.equal(s.board.filter(Boolean).length,32);assert.equal(s.board[76],G.K);assert.equal(s.board[13],-G.K);assert.deepEqual(G.points(s.board),{cho:72,han:73.5});}
 assert.equal(G.legalMoves(G.create()).length,31);assert.equal(G.legalMoves(G.create()).some(m=>Math.abs(G.create().board[m.from])===G.C),false);
});
test('궁·사는 자기 궁성의 선으로만 이동',()=>{
 const b=bare();b[76]=0;b[66]=G.K;
 assert.deepEqual(G.pseudoMoves(b,66).sort((a,b)=>a-b),[67,75,76]);
 b[66]=0;b[67]=G.K;assert.equal(G.pseudoMoves(b,67).includes(75),false);assert.equal(G.pseudoMoves(b,67).includes(58),false);
 b[84]=G.A;assert.ok(G.pseudoMoves(b,84).includes(76));
});
test('차·포의 직선과 궁 대각선, 포는 포를 넘지도 잡지도 못함',()=>{
 const b=bare();b[30]=G.C;assert.equal(G.pseudoMoves(b,30).includes(33),false);b[31]=G.P;assert.ok(G.pseudoMoves(b,30).includes(33));
 b[33]=-G.C;assert.equal(G.pseudoMoves(b,30).includes(33),false);b[31]=-G.C;assert.equal(G.pseudoMoves(b,30).includes(32),false);
 const p=bare();p[3]=G.C;p[13]=-G.P;assert.ok(G.pseudoMoves(p,3).includes(23));p[13]=-G.C;assert.equal(G.pseudoMoves(p,3).includes(23),false);
 const r=bare();r[3]=G.R;r[13]=0;assert.ok(G.pseudoMoves(r,3).includes(23));r[13]=G.P;assert.equal(G.pseudoMoves(r,3).includes(23),false);
});
test('마의 첫 멱·상의 두 경유점, 상은 판 전체를 이동',()=>{
 const b=bare();b[49]=0;b[40]=G.H;assert.ok(G.pseudoMoves(b,40).includes(59));b[49]=G.P;assert.equal(G.pseudoMoves(b,40).includes(59),false);
 b[40]=G.E;b[49]=0;assert.ok(G.pseudoMoves(b,40).includes(69));b[49]=G.P;assert.equal(G.pseudoMoves(b,40).includes(69),false);b[49]=0;b[59]=-G.P;assert.equal(G.pseudoMoves(b,40).includes(69),false);
 b[59]=0;b[40]=0;b[22]=G.E;assert.ok(G.pseudoMoves(b,22).includes(51));
});
test('졸은 앞·옆, 상대 궁성 간선의 앞 대각선, 후퇴·승급 없음',()=>{
 const b=bare();b[49]=G.P;assert.ok(G.pseudoMoves(b,49).includes(40));assert.equal(G.pseudoMoves(b,49).includes(58),false);
 b[21]=G.P;assert.ok(G.pseudoMoves(b,21).includes(13));assert.equal(G.pseudoMoves(b,21).includes(31),false);
 b[4]=G.P;assert.ok(G.pseudoMoves(b,4).includes(3));
});
test('무작위 100판 모든 출발·목적지 행마를 별도 경로 검사와 비교',()=>{
 const rand=M.createSeededRandom('janggi-independent');let compared=0;
 for(let trial=0;trial<100;trial++){
  const b=bare();for(let n=0;n<24;n++){const i=Math.floor(rand()*90),s=rand()<.5?1:-1,t=2+Math.floor(rand()*6);if(!b[i]&&(t!==G.A||G.palace(i,s)))b[i]=s*t;}
  for(let i=0;i<90;i++)if(b[i]){const actual=new Set(G.pseudoMoves(b,i));for(let j=0;j<90;j++){assert.equal(actual.has(j),Boolean(reference(b,i,j)),`판 ${trial}: ${i} → ${j}`);compared++;}}
 }assert.ok(compared>150000);
});
test('궁이 공격받는 수·장군 중 한 수 쉼·궁 직접 잡기를 금지',()=>{
 const b=bare();b[49]=G.R;b[22]=-G.R;const p=G.position(b,true);
 assert.equal(G.inCheck(b,1),false);assert.equal(G.legalMoves(p).some(m=>m.from===49&&m.to===48),false);
 b[49]=0;assert.ok(G.inCheck(b,1));assert.equal(G.canPass(G.position(b,true)),false);
 assert.ok(G.legalMoves(G.position(b,true)).every(m=>Math.abs(b[m.to])!==G.K));
});
test('합법 수 40개 판을 별도 공격 검사와 비교',()=>{
 const rand=M.createSeededRandom('janggi-legality');let p=G.create();
 for(let n=0;n<40;n++){
  const expected=[];for(let i=0;i<90;i++)if(Math.sign(p.board[i])===p.turn)for(let j=0;j<90;j++)if(Math.abs(p.board[j])!==G.K&&reference(p.board,i,j)){
   const b=p.board.slice();b[j]=b[i];b[i]=0;if(!referenceCheck(b,p.turn)&&(p.capturedAny||!G.facing(b)))expected.push({from:i,to:j});
  }
  assert.deepEqual(G.legalMoves(p).sort((a,b)=>a.from-b.from||a.to-b.to),expected);if(p.over)break;const moves=G.legalActions(p),m=moves[Math.floor(rand()*moves.length)];p=G.advance(p,m);
 }
});
test('빅장: 잡힘 전 제한, 응수로 해제하거나 한 수 뒤 점수 판정',()=>{
 const b=bare();b[49]=G.R;const p=G.position(b,false),move={from:49,to:48};assert.equal(G.isLegal(p,move),false);
 p.capturedAny=true;assert.ok(G.isLegal(p,move));const offered=G.advance(p,move);assert.ok(offered.bikjang);assert.equal(offered.over,false);
 const ended=G.advance(offered,{pass:true});assert.ok(ended.over);assert.equal(ended.reason,'bikjang');
 const broken=G.advance(offered,{from:13,to:12});assert.equal(broken.bikjang,false);assert.equal(broken.over,false);
});
test('서로 한 수 쉼은 한의 덤을 포함한 점수로 종료',()=>{
 let p=G.create();p=G.advance(p,{pass:true});p=G.advance(p,{pass:true});assert.equal(p.reason,'passes');assert.equal(p.winner,-1);assert.equal(p.ply,0);
});
test('차례까지 같은 판을 네 번째 만든 쪽 반복 패배',()=>{
 let p=G.position(bare(),true);const cycle=[{from:76,to:75},{from:13,to:12},{from:75,to:76},{from:12,to:13}];
 for(let i=0;i<12;i++){const a=cycle[i%4];assert.ok(G.isLegal(p,a));p=G.advance(p,a);}
 assert.ok(p.over);assert.equal(p.reason,'repetition');assert.equal(p.winner,1);
});
test('1000일 외통 문제: 시작은 비장군, 모든 정답 수를 외통으로 검증',()=>{
 const signatures=new Set();
 for(let i=0;i<1000;i++){
  const day=new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),s=G.create('medium',{daily:day});
  assert.equal(G.inCheck(s.board,1),false);assert.equal(G.inCheck(s.board,-1),false);assert.ok(G.isValid(s));
  signatures.add(s.board.join(','));const moves=G.matingMoves(s);assert.ok(moves.length);
  for(const a of moves){const next=G.advance(s,a);assert.ok(referenceCheck(next.board,-1));assert.equal(G.legalMoves({...next,over:false}).length,0);}
 }assert.ok(signatures.size>200);
});
test('무르기는 내 착수와 컴퓨터 응수를 함께 되돌리고 도움 사용은 보존',()=>{
 const s=G.create(),original=clone(s);G.move(s,G.legalMoves(s)[0]);G.move(s,G.legalMoves(s)[0]);s.hintsUsed=1;assert.ok(G.undo(s));
 assert.deepEqual(s.board,original.board);assert.deepEqual(s.actions,[]);assert.equal(s.turn,1);assert.equal(s.undoUsed,1);assert.equal(s.hintsUsed,1);assert.ok(G.isValid(s));
 G.move(s,G.legalMoves(s)[0]);assert.ok(G.undo(s));assert.equal(s.turn,1);assert.ok(G.isValid(s));
});
test('외통 실패·무르기·다시 정답, 저장 왕복과 기권',()=>{
 const s=G.create('medium',{daily:'2026-11-24'});G.move(s,{pass:true});assert.ok(s.puzzleAttempted);assert.equal(s.over,false);assert.ok(G.undo(s));G.move(s,G.matingMoves(s)[0]);assert.equal(s.reason,'mate');assert.equal(s.puzzleAttempts,2);assert.ok(G.isValid(clone(s)));
 const t=G.create();assert.ok(G.resign(t));assert.equal(t.winner,-1);assert.ok(G.isValid(t));
});
test('세 수준 탐색은 합법적·결정적·노드 제한 내, 즉시 외통을 찾음',()=>{
 for(const difficulty of Object.keys(G.DIFFICULTIES)){const s=G.create(difficulty),before=clone(s),diagnostics={};const move=AI.chooseMove(s,{diagnostics});assert.ok(G.isLegal(s,move));assert.deepEqual(AI.chooseMove(s),move);assert.deepEqual(s,before);assert.ok(diagnostics.nodes<=G.DIFFICULTIES[difficulty].nodes);}
 const s=G.create('medium',{daily:'2026-11-24'});assert.ok(G.matingMoves(s).some(a=>G.sameAction(a,AI.chooseMove(s))));
});
test('무작위 150수 저장·재현과 잘못된 저장 거절',()=>{
 const rand=M.createSeededRandom('janggi-save'),s=G.create();for(let i=0;i<150&&!s.over;i++){const actions=G.legalActions(s);G.move(s,actions[Math.floor(rand()*actions.length)]);if(i%20===0)assert.ok(G.isValid(clone(s)));}
 assert.ok(G.isValid(s));for(const change of [x=>x.board[0]=99,x=>x.turn=0,x=>x.keys=[],x=>x.undoMarks=[999],x=>x.winner=1,x=>x.elapsed=-1,x=>x.actions.push({from:0,to:0})]){const t=clone(s);change(t);assert.equal(G.isValid(t),false);}
});

test('200번째 수의 외통은 점수보다 우선하고 일반 탐색도 외통을 찾음',()=>{
 const p=G.create('medium',{daily:'2026-11-24'});p.kind='match';p.ply=199;
 const move=AI.chooseMove(p,{depth:1,nodes:500}),n=G.advance(p,move);
 assert.equal(n.reason,'mate');assert.equal(n.winner,1);
});
test('컴퓨터는 공격받지 않는 상대 차를 잡는 수를 선택',()=>{
 const p=G.position(bare(),true);p.board[40]=G.R;p.board[42]=-G.R;p.kind='match';p.difficulty='medium';
 const move=AI.chooseMove(p,{depth:2,nodes:1200});assert.equal(move.to,42);assert.ok(G.isLegal(p,move));
});
