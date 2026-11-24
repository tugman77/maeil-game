const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../klondike/js/logic.js'),D=require('../klondike/js/deals.js'),M=require('../common/core.js');
const copy=s=>JSON.parse(JSON.stringify(s));
// 독립된 규칙으로 뽑기·재순환·노출·묶음 이동을 검증한다.
function reference(s,a){
 if(a.type==='draw'){if(s.stock.length)s.waste.push(s.stock.pop());else{assert.ok(s.waste.length);s.stock=s.waste.slice().reverse();s.waste=[];}return;}
 const f=a.from,t=a.to;let cards;
 if(f.type==='column'){assert.ok(f.start>=s.hidden[f.index]);cards=s.columns[f.index].slice(f.start);}
 else if(f.type==='waste'){assert.equal(f.index,0);cards=[s.waste.at(-1)];}
 else cards=[f.index*13+s.foundations[f.index]-1];
 assert.ok(cards.length&&cards.every(c=>Number.isInteger(c)&&c>=0&&c<52));
 for(let i=1;i<cards.length;i++){assert.equal(cards[i-1]%13,cards[i]%13+1);assert.notEqual(Math.floor(cards[i-1]/13)%2,Math.floor(cards[i]/13)%2);}
 if(t.type==='foundation'){assert.notEqual(f.type,'foundation');assert.equal(cards.length,1);assert.equal(Math.floor(cards[0]/13),t.index);assert.equal(cards[0]%13+1,s.foundations[t.index]+1);}
 else{const p=s.columns[t.index].at(-1);if(p===undefined)assert.equal(cards[0]%13,12);else{assert.equal(p%13,cards[0]%13+1);assert.notEqual(Math.floor(p/13)%2,Math.floor(cards[0]/13)%2);}}
 if(f.type==='waste')s.waste.pop();else if(f.type==='foundation')s.foundations[f.index]--;else{s.columns[f.index].splice(f.start);if(s.hidden[f.index]&&s.columns[f.index].length===s.hidden[f.index])s.hidden[f.index]--;}
 if(t.type==='foundation')s.foundations[t.index]++;else s.columns[t.index].push(...cards);
}
test('7줄 1~7장·뒷면 21장·덱 24장, 전체 52장',()=>{
 const s=G.create('medium',{dealNumber:1});assert.ok(G.isValid(s));assert.deepEqual(s.columns.map(c=>c.length),[1,2,3,4,5,6,7]);assert.deepEqual(s.hidden,[0,1,2,3,4,5,6]);assert.equal(s.stock.length,24);assert.equal(s.waste.length,0);
});
test('48개 원본 풀이를 독립 규칙으로 전체 재생',()=>{
 assert.equal(D.length,48);for(const d of D){const expected=G.rawDeal(d.seed),actual=copy(expected);for(const encoded of d.solution){const a=G.decode(encoded);reference(expected,a);assert.ok(G.applyAction(actual,a));assert.deepEqual(actual,expected);assert.ok(G.validPosition(actual));}assert.ok(G.isDone(actual));}
});
test('3난이도 365개 변환 배치·날짜별 동일 문제',()=>{
 for(const k of Object.keys(G.DIFFICULTIES))for(let i=0;i<365;i++){const s=G.create(k,{dealNumber:i*9817});assert.ok(G.isValid(s));}
 const make=day=>G.create('medium',{daily:day,random:M.dailyRandom('klondike',day)});assert.deepEqual(make('2026-11-24'),make('2026-11-24'));assert.notDeepEqual(make('2026-11-24').initial,make('2026-11-25').initial);
});
test('한 장 뽑기·덱 재순환 순서·되돌리기',()=>{
 const s=G.create('easy',{dealNumber:1}),original=s.stock.slice();
 for(let i=0;i<24;i++)assert.ok(G.draw(s));const before=copy(s);assert.equal(s.stock.length,0);assert.equal(s.waste.length,24);
 G.draw(s);assert.deepEqual(s.stock,original);assert.equal(s.waste.length,0);assert.equal(s.passes,1);assert.ok(G.isValid(s));
 G.undo(s);assert.deepEqual(s.stock,before.stock);assert.deepEqual(s.waste,before.waste);assert.equal(s.passes,0);
});
test('빈 줄에는 K, 줄에는 다른 색 내림차순, 뒷면은 선택 불가',()=>{
 const s={columns:[[12],[24],[],[],[],[],[]],hidden:[0,0,0,0,0,0,0],waste:[],stock:[],foundations:[0,0,0,0]};
 assert.ok(G.canMove(s,{type:'column',index:0,start:0},{type:'column',index:2}));assert.equal(G.canMove(s,{type:'column',index:1,start:0},{type:'column',index:2}),false);
 assert.ok(G.canMove(s,{type:'column',index:1,start:0},{type:'column',index:0}));
 const full=G.create('medium',{dealNumber:2});assert.equal(G.sourceCards(full,{type:'column',index:6,start:0}),null);assert.equal(G.sourceCards(full,{type:'waste',index:99}),null);
});
test('카드를 옮겨 노출된 뒷면을 자동 뒤집고 되돌리면 함께 복원',()=>{
 const s=G.create('medium',{dealNumber:42});let chosen;
 for(const a of s.solution){if(a.from?.type==='column'&&s.hidden[a.from.index]>0&&a.from.start===s.hidden[a.from.index]){chosen=a;break;}if(a.type==='draw')G.draw(s);else G.move(s,a.from,a.to);}
 assert.ok(chosen);const before=copy(s),i=chosen.from.index;G.move(s,chosen.from,chosen.to);assert.equal(s.hidden[i],before.hidden[i]-1);G.undo(s);assert.deepEqual(G.snapshot(s),G.snapshot(before));
});
test('완성 칸에서 카드 줄로 되가져오기',()=>{
 const s={columns:[[14],[],[],[],[],[],[]],hidden:[0,0,0,0,0,0,0],stock:[],waste:[],foundations:[1,0,0,0]};
 assert.ok(G.canMove(s,{type:'foundation',index:0},{type:'column',index:0}));assert.ok(G.apply(s,{type:'foundation',index:0},{type:'column',index:0}));assert.equal(s.foundations[0],0);assert.deepEqual(s.columns[0],[14,0]);
});
test('추천은 상태 보존, 자동 정리는 한 번에 되돌릴 수 있음',()=>{
 const s=G.create('easy',{dealNumber:55}),map=G.solutionMap(s),initial=copy(s);const hint=G.hint(s,map);assert.ok(hint);assert.deepEqual(s,initial);
 for(const a of s.solution){if(G.safeMove(s))break;if(a.type==='draw')G.draw(s);else G.move(s,a.from,a.to);}
 const before=copy(s),n=G.autoFoundation(s);assert.ok(n>0);G.undo(s);assert.deepEqual(G.snapshot(s),G.snapshot(before));assert.ok(G.isValid(s));
});
test('임의 합법 이동 후에도 52장·뒤집힘·저장 형태 보존',()=>{
 for(let seed=0;seed<12;seed++){const s=G.create('medium',{dealNumber:seed}),r=M.createSeededRandom('kl-play:'+seed);for(let i=0;i<100&&!G.isDone(s);i++){const actions=G.legalMoves(s);if(!actions.length)break;const a=actions[Math.floor(r()*actions.length)];if(a.type==='draw')G.draw(s);else G.move(s,a.from,a.to);assert.ok(G.validPosition(s));if(i%15===0)assert.ok(G.isValid(s));}}
});
test('잘못된 이동은 상태 보존, 손상 저장과 풀이 거부',()=>{
 const base=G.create('medium',{dealNumber:8}),before=copy(base);assert.equal(G.move(base,{type:'column',index:9,start:0},{type:'column',index:0}),false);assert.deepEqual(base,before);
 for(const fn of [s=>s.columns[0][0]=99,s=>s.stock[0]=s.columns[0][0],s=>s.hidden[0]=1,s=>s.solution[0]={},s=>s.history=[{}],s=>s.moves=-1,s=>s.passes=-1,s=>s.difficulty='__proto__']){const s=copy(base);fn(s);assert.equal(G.isValid(s),false);}
});
