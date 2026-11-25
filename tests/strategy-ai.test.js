const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const J=require('../janggi/js/logic'),AI=require('../janggi/js/ai'),O=require('../omok/js/logic');
const at=(x,y)=>y*13+x,clone=s=>JSON.parse(JSON.stringify(s));
const board=pairs=>{const b=Array(90).fill(0);pairs.forEach(([i,v])=>b[i]=v);return b;};
const mates=[
 [[4,-1],[7,3],[12,7],[32,3],[42,7],[76,1]], // two rooks
 [[1,4],[2,3],[4,-1],[23,7],[33,7],[76,1]], // cannon screen
 [[4,-1],[11,5],[16,7],[21,3],[24,7],[76,1]], // horse
 [[2,3],[4,-1],[5,7],[14,7],[19,6],[76,1]], // elephant
 [[4,-1],[13,7],[15,3],[30,7],[45,7],[76,1]], // pawn
];
function mateOracle(p,side,depth){
 if(p.over)return p.reason==='mate'&&p.winner===side;
 if(!depth)return false;const answers=J.legalActions(p).map(a=>()=>mateOracle(J.advance(p,a),side,depth-1));
 return p.turn===side?answers.some(f=>f()):answers.every(f=>f());
}
test('장기 실제 외통 5유형과 상하 반전: 즉시 종료·장군 쉼 불가·수 없음',()=>{
 for(const pairs of mates)for(const side of [1,-1]){
  const b=board(pairs),position=side===1?b:b.slice().reverse().map(v=>-v);
  const p={...J.position(position,true),turn:-side,over:false};
  assert.ok(J.inCheck(p.board,p.turn));assert.equal(J.canPass(p),false);assert.deepEqual(J.legalActions(p),[]);
  J.adjudicate(p);assert.equal(p.over,true);assert.equal(p.reason,'mate');assert.equal(p.winner,side);
 }
});
test('장기 외통은 생략 옵션·빅장·200수·반복보다 우선, 반대 차례도 동일',()=>{
 for(const side of [1,-1]){
  const b=board([[4,-1],[23,7],[29,7],[32,3],[76,1]]);
  const p=J.position(side===1?b:b.slice().reverse().map(v=>-v),true);p.turn=side;p.over=false;p.kind='match';p.difficulty='hard';
  const r=AI.analyze(p,{depth:3,nodes:10000,timeMs:1000});assert.equal(r.forced.winner,side);assert.equal(r.forced.plies,3);
  assert.ok(mateOracle(p,side,3));
  const next=J.advance(p,r.move);const loss=AI.analyze({...next,kind:'match',difficulty:'hard'},{depth:3,nodes:10000,timeMs:1000});
  assert.equal(loss.forced.winner,side);assert.match(J.decision({...next,kind:'match'},loss).text,/1수 안에 외통/);
  // Exercise each mate-producing branch, including the old advance(..., false) path.
  for(const reply of J.legalActions(next)){
   const last=J.advance(next,reply),mating=J.matingMoves(last)[0];assert.ok(mating);
   last.ply=199;last.bikjang=true;
   const n=J.advance(last,mating,false);assert.equal(n.reason,'mate');
  }
 }
});
test('장기 무르기 재생은 외통을 복원하고 옛 외통 누락 저장을 안전하게 복구',()=>{
 const s=J.create('medium',{daily:'2026-11-25'});J.move(s,J.matingMoves(s)[0]);
 const legacy=clone(s);legacy.over=false;legacy.winner=0;legacy.reason='';
 const restored=J.restore(legacy);assert.ok(restored);assert.equal(restored.reason,'mate');assert.equal(restored.over,true);
 const bad=clone(legacy);bad.board[0]=99;assert.equal(J.restore(bad),null);
 // Undo's replay validates terminal positions even when its legality scan is skipped.
 const p={...clone(s),actions:[...s.actions,{pass:true}],undoMarks:[1],kind:'match'};
 assert.ok(J.undo(p));assert.equal(p.over,true);assert.equal(p.reason,'mate');
});
test('장기 기권 양쪽·구버전 기권·기물 열세 연속 6차례·계속두기 저장',()=>{
 for(const loser of [1,-1]){const s=J.create();assert.ok(J.resign(s,loser));assert.equal(s.winner,-loser);assert.ok(J.isValid(s));}
 const old=J.create();J.resign(old);delete old.actions[0].side;assert.ok(J.isValid(old));
 let p={...J.position(board([[4,-1],[32,3],[29,3],[76,1],[49,7]]),true),kind:'match'};
 for(let k=0;k<6;k++){
  const actions=J.legalMoves(p).filter(a=>!p.board[a.to]);assert.ok(actions.length);
  p=J.advance(p,actions[0]);if(k<5)assert.equal(J.decision(p,null),null);
 }
 assert.equal(p.leadCount,6);assert.equal(J.decision(p,null).winner,1);assert.match(J.decision(p,null).text,/20점/);
 const s=J.create();s.continueDecided=true;s.leadCount=100;s.leadSide=-1;
 assert.equal(J.restore(s).continueDecided,true);assert.equal(J.restore(s).leadCount,0);
 const puzzle=J.create('medium',{daily:'2026-11-25'});assert.equal(J.decision(puzzle,{forced:{winner:1,plies:1}}),null);
});
function omok(pairs,turn=2){const s=O.create('hard',{seedText:'fixture'});for(const [x,y,c] of pairs)s.board[at(x,y)]=c;s.moves=turn===2?[pairs.find(([x,y,c])=>c===1)].map(([x,y])=>at(x,y)):[];return s;}
function four(color=1){return [3,4,5,6].map(x=>[x,6,color]);}
test('오목 열린4·끊긴4-4·4-3와 연속4 증명, 색과 차례·반격 우선',()=>{
 const fixtures=[
  four(),
  [[3,6,1],[4,6,1],[6,6,1],[7,6,1],[6,4,1],[6,5,1],[6,8,1]],
  [...four(),[2,6,2],[5,4,1],[5,5,1]],
 ];
 for(const pairs of fixtures)for(const swap of [false,true]){
  const p=swap?pairs.map(([x,y,c])=>[x,y,3-c]):pairs;
  const s=omok(p,swap?1:2),before=clone(s),r=O.analyze(s,{assessOnly:true,timeMs:300});
  assert.equal(r.forced?.winner,swap?2:1,JSON.stringify(p));assert.deepEqual(s,before);
  assert.match(O.decision(s,r).text,swap?/백 승리/:/흑 승리/);
 }
 // A four-three is not a win when the opponent can finish five immediately.
 const counter=omok([...fixtures[2],...[2,3,4,5].map(x=>[x,1,2])]);
 const r=O.analyze(counter);assert.equal(r.forced.winner,2);assert.ok([at(1,1),at(6,1)].includes(r.move));
 const sharedGap=omok([[3,6,1],[4,6,1],[6,6,1],[7,6,1],[5,3,1],[5,4,1],[5,5,1],[5,7,1]]);
 assert.equal(O.analyze(sharedGap,{assessOnly:true}).forced,null);
 // Edge and blocked lines must not be mistaken for an open four.
 const closed=omok([[0,0,1],[1,0,1],[2,0,1],[3,0,1],[4,0,2]]);
 assert.equal(O.analyze(closed,{assessOnly:true}).forced,null);
});
test('오목 어려움 전술: 열린3 차단·4-3 만들기·상대 VCF 막기',()=>{
 for(const difficulty of ['medium','hard']){
  const s=omok([[4,6,1],[5,6,1],[6,6,1],[9,3,2],[9,4,2]]);s.difficulty=difficulty;
  assert.ok([at(3,6),at(7,6)].includes(O.chooseMove(s)),difficulty+' 열린3 방어');
  const attack=omok([[3,6,2],[4,6,2],[5,6,2],[5,4,2],[5,5,2],[0,0,1]]);attack.difficulty=difficulty;
  const r=O.analyze(attack);assert.equal(r.forced.winner,2);attack.board[r.move]=2;
  assert.ok(O.winningMoves(attack.board,2).length>=2||O.analyze({...attack,moves:[]},{assessOnly:true}).forced?.winner===2);
 }
});
test('오목 판이 차기 전 무승부·기권 저장·옛 판 복원·쉬움 실수 유지',()=>{
 const s=O.create();for(let y=0;y<13;y++)for(let x=0;x<13;x++)s.board[at(x,y)]=(x+2*y)%4<2?1:2;
 s.board[84]=0;assert.equal(O.canMakeFive(s.board),false);
 s.opening=s.board.flatMap((v,i)=>v?[[i,v]]:[]);s.moves=[];s.over=false;
 assert.ok(O.isValid(s));assert.equal(O.restore(s).reason,'draw');assert.equal(O.restore(s).winner,0);
 for(const loser of [1,2]){const p=O.create();assert.ok(O.resign(p,loser));assert.equal(p.winner,3-loser);assert.ok(O.isValid(p));}
 const old=O.create('easy',{seedText:'old'});O.play(old,84);O.aiMove(old);assert.ok(O.restore(old));
 let errors=0;for(let k=0;k<40;k++){
  const p=omok([[4,6,1],[5,6,1],[6,6,1],[7,6,1],[3,6,2]]);p.difficulty='easy';p.rng=k*39317+1;
  if(O.chooseMove(p)!==at(8,6))errors++;
 }assert.ok(errors>0);
});
test('실제 Worker 진입점에서 분석·기권 자료를 반환하고 UI 스레드는 계산하지 않음',()=>{
 for(const [name,state] of [['janggi',J.create()],['omok',omok(four())]]){
  let output;const context=vm.createContext({console,Date,importScripts(...paths){for(const p of paths){const path=require('node:path').resolve(name+'/js',p);vm.runInContext(fs.readFileSync(path,'utf8'),context);}},self:{postMessage(v){output=v;}}});
  vm.runInContext(fs.readFileSync(name+'/js/ai-worker.js','utf8'),context);
  context.self.onmessage({data:{id:73,state,options:{timeMs:50,nodes:250}}});assert.equal(output.id,73);assert.equal(output.error,undefined);assert.ok(output.report);
 }
});
test('탐색 실제 시간 상한·중단 시 확정 오인 금지·원본 판 보존',()=>{
 for(const difficulty of ['medium','hard']){
  const s=J.create(difficulty),before=clone(s),r=AI.analyze(s);assert.ok(r.elapsedMs<(difficulty==='medium'?1100:2600));assert.ok(J.isLegal(s,r.move));assert.deepEqual(s,before);
  assert.equal(AI.analyze(s,{nodes:64,timeMs:1}).forced,null);
  const o=O.create(difficulty);O.play(o,84);const start=Date.now(),or=O.analyze(o);assert.ok(Date.now()-start<2000);assert.equal(o.board[or.move],0);assert.equal(or.forced,null);
 }
});

test('오목 어려움은 기존 평가가 놓치던 5수·7수 VCF를 찾고 반대 색의 VCF도 차단',()=>{
 const fixtures=[
  {pairs:[[8,3,2],[3,5,2],[7,5,1],[4,7,2],[5,7,2],[8,7,1],[5,8,1],[9,8,1],[4,9,2],[7,9,2]],move:82,plies:5},
  {pairs:[[3,3,2],[4,3,1],[5,5,2],[6,5,1],[7,7,2],[3,8,1],[5,8,2],[6,8,2],[5,9,1],[8,9,2]],move:84,plies:7},
 ];
 for(const f of fixtures){
  const s=omok(f.pairs),r=O.analyze(s);assert.equal(r.move,f.move);assert.deepEqual(r.forced,{winner:2,plies:f.plies});
  const defense=omok(f.pairs.map(([x,y,c])=>[x,y,3-c])),d=O.analyze(defense);defense.board[d.move]=2;
  assert.equal(O.analyze({...defense,moves:[]},{assessOnly:true}).forced,null);
 }
});
