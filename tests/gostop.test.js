const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../gostop/js/logic'),AI=require('../gostop/js/ai'),M=require('../common/core');
const rng=k=>M.createSeededRandom('gostop-test:'+k);
function fixture({hand=[0],table=[1],draw=4,opp=[12],captured=[[],[]],rest=true}={}) {
 const used=[...hand,...table,draw,...opp,...captured.flat()];assert.equal(new Set(used).size,used.length);
 const deck=Array.from({length:48},(_,i)=>i).filter(id=>!used.includes(id));
 const s=G.create(rng('fixture'));Object.assign(s,{hands:[hand,opp],table,stock:[draw,...(rest?deck:[])],captured,turn:0,phase:'play',pending:null,tx:null,go:[0,0],lastGo:[0,0],shaken:[[],[]],skips:[0,0],revealed:[[],[]],ppuk:{},ppukCount:[0,0],turns:[0,0],events:[],result:null,log:[]});return s;
}
const play=(s,id)=>G.apply(s,{type:'play',id});
const pi=G.cards.filter(c=>c.pi).map(c=>c.id);
function owned(s){const ids=[...s.hands.flat(),...s.table,...s.stock,...s.captured.flat()];if(s.tx){ids.push(...s.tx.capture);if(s.pending.kind==='hand')ids.push(s.tx.played);else ids.push(s.tx.draw);}return ids.sort((a,b)=>a-b);}

test('48장·12달·광5 열9 띠10 피24와 두 쌍피, 고도리·단 구성',()=>{
 assert.equal(G.cards.length,48);for(let m=1;m<=12;m++)assert.equal(G.cards.filter(c=>c.month===m).length,4);
 for(const [t,n] of [['광',5],['열',9],['띠',10],['피',24]])assert.equal(G.cards.filter(c=>c.type===t).length,n);
 assert.deepEqual(G.cards.filter(c=>c.pi===2).map(c=>c.id),[41,47]);assert.equal(G.cards[32].type,'열');
 for(const set of ['홍단','청단','초단'])assert.equal(G.cards.filter(c=>c.set===set).length,3);assert.equal(G.cards[46].set,'비띠');
});
test('광 0~5장·비삼광·사광',()=>{
 for(const [ids,n] of [[[],0],[[0,8],0],[[0,8,28],3],[[0,8,44],2],[[0,8,28,44],4],[[0,8,28,40,44],15]])assert.equal(G.score(ids).points.광,n);
});
test('열끗·고도리·띠·홍단·청단·초단·쌍피 경계',()=>{
 assert.equal(G.score([4,12,29]).points.고도리,5);assert.equal(G.score([4,12,45]).points.고도리,0);
 const animals=G.cards.filter(c=>c.type==='열').map(c=>c.id);for(let n=0;n<=9;n++)assert.equal(G.score(animals.slice(0,n)).points.열끗,Math.max(0,n-4));
 const ribbons=G.cards.filter(c=>c.type==='띠').map(c=>c.id);assert.equal(G.score(ribbons).total,15);
 assert.equal(G.score([1,5,9]).points.홍단,3);assert.equal(G.score([13,17,25]).points.초단,3);assert.equal(G.score([13,17,46]).points.초단,undefined);
 for(let n=0;n<13;n++){const ids=pi.filter(id=>G.cards[id].pi===1).slice(0,n);assert.equal(G.score(ids).points.피,Math.max(0,n-9));}
 const x=pi.filter(id=>G.cards[id].pi===1).slice(0,8);assert.equal(G.score([...x,41]).points.피,1);
});
test('고 가산·3고 이후 배수·피박 경계·광박·멍따·고박·흔들기 중첩',()=>{
 const s=fixture();s.captured=[pi.filter(id=>G.cards[id].pi===1).slice(0,13),[]];
 for(let go=0;go<=6;go++){s.go[0]=go;const x=G.settlement(s,0);assert.equal(x.total,(4+Math.min(go,2))*2**Math.max(0,go-2));}
 s.go=[0,0];for(const [n,bak] of [[0,false],[1,true],[7,true],[8,false]]){s.captured[1]=pi.filter(id=>G.cards[id].pi===1).slice(13,13+n); // 필요하면 중복 없는 다른 족보와 독립적인 점수 단위 검사
 if(n===8)s.captured[1]=[41,47,...pi.filter(id=>G.cards[id].pi===1).slice(13,17)];
 assert.equal(G.settlement(s,0).factors.some(f=>f.name==='피박'),bak);}
 s.captured=[G.cards.filter(c=>c.type==='열'||c.type==='광').map(c=>c.id),[]];s.go=[3,1];s.shaken[0]=[2,3];const x=G.settlement(s,0);assert.equal(x.multiplier,2*4*2*2*2);assert.equal(x.total,(G.score(s.captured[0]).total+2)*x.multiplier);
});
test('손패/더미 다른 달 두 쌍·짝 없음·세 장 묶음',()=>{
 let s=play(fixture({hand:[0],table:[1,5],draw:4}),0);assert.deepEqual(s.captured[0].sort((a,b)=>a-b),[0,1,4,5]);
 s=play(fixture({hand:[0],table:[5],draw:8}),0);assert.ok(s.table.includes(0)&&s.table.includes(8));
 s=play(fixture({hand:[0],table:[1,2,3],draw:4,captured:[[],[6]]}),0);assert.ok([0,1,2,3,6].every(id=>s.captured[0].includes(id)));
});
test('두 바닥패 선택 전에는 더미 공개 없음; 두 번째 패 선택도 정확히 획득',()=>{
 const s=fixture({hand:[0,16],table:[1,2],draw:4});let a=play(s,0);assert.equal(a.phase,'choose');assert.equal(a.pending.kind,'hand');assert.equal(a.stock[0],4);assert.equal(a.lastDraw,null);assert.equal(a.tx.draw,null);
 a=G.apply(a,{type:'choose',id:2});assert.ok(a.captured[0].includes(2));assert.ok(!a.captured[0].includes(1));assert.ok(a.table.includes(1));assert.equal(G.apply(a,{type:'choose',id:1}),null);
});
test('뒤집은 패와 같은 달 두 장이면 별도 선택과 저장 도중 재생',()=>{
 let s=play(fixture({hand:[0,16],table:[5,6],draw:4}),0);assert.equal(s.phase,'choose');assert.equal(s.pending.kind,'draw');s=G.apply(s,{type:'choose',id:6});assert.ok(s.captured[0].includes(6));assert.ok(s.table.includes(5));
 // 실제 합법 배치에서 선택 중 저장을 탐색한다.
 let found=false;for(let k=0;k<100&&!found;k++){let x=G.create(rng(k));for(let n=0;n<60&&x.phase!=='ended';n++){x=G.apply(x,AI.choose(G.view(x)));if(x.phase==='choose'){assert.deepEqual(G.restore(x),x);found=true;break;}}}assert.ok(found);
});
test('뻑은 세 장 남김, 뻑 소유자 기록·자뻑은 피 두 장 가치',()=>{
 let s=play(fixture({hand:[0,16],table:[1],draw:2,captured:[[],[6,7,41]]}),0);assert.equal(s.captured[0].length,0);assert.ok([0,1,2].every(id=>s.table.includes(id)));assert.equal(s.ppuk[1],0);assert.equal(s.ppukCount[0],1);
 s.turn=0;s.phase='play';s.hands[0]=[3,16];s.stock=[8,...s.stock.filter(id=>id!==8)];s=play(s,3);assert.ok([0,1,2,3,6,7].every(id=>s.captured[0].includes(id)));assert.ok(s.captured[1].includes(41));assert.equal(s.ppuk[1],undefined);
});
test('쪽·따닥·쓸, 겹친 피 이동, 홑피 우선·쌍피만 남으면 이동',()=>{
 let s=play(fixture({hand:[0,16],table:[8],draw:1,captured:[[],[6,41]]}),0);assert.match(s.events.join(','),/쪽/);assert.ok(s.captured[0].includes(6));assert.ok(s.captured[1].includes(41));
 for(const target of [1,2]){s=play(fixture({hand:[0,16],table:[1,2],draw:3,captured:[[],[6,7,41]]}),0);s=G.apply(s,{type:'choose',id:target});assert.deepEqual(s.captured[0].sort((a,b)=>a-b),[0,1,2,3,6,7]);assert.equal(new Set(s.captured[0]).size,s.captured[0].length);assert.match(s.events.join(','),/따닥.*쓸/);}
 s=play(fixture({hand:[0,16],table:[8],draw:1,captured:[[],[41]]}),0);assert.ok(s.captured[0].includes(41));
});
test('판 마지막 차례 쪽·따닥·쓸 피 받기 제외, 뻑 가져오기는 유지',()=>{
 let s=play(fixture({hand:[0],opp:[],table:[],draw:1,captured:[[],[6]],rest:false}),0);assert.ok(s.captured[1].includes(6));assert.equal(s.phase,'ended');
 s=fixture({hand:[0],opp:[],table:[1,2,3],draw:8,captured:[[],[6]],rest:false});s.ppuk[1]=1;s=play(s,0);assert.ok(s.captured[0].includes(6));
});
test('흔들기는 세 장 공개·한 달 한 번, 폭탄과 중복 배수 금지',()=>{
 let s=fixture({hand:[0,1,2,16],table:[3],draw:8});assert.ok(G.legal(s).some(a=>a.type==='bomb'));
 s=G.apply(s,{type:'shake',month:1});assert.deepEqual(s.revealed[0],[0,1,2]);assert.deepEqual(s.shaken[0],[1]);assert.ok(!G.legal(s).some(a=>a.type==='shake'||a.type==='bomb'));assert.equal(G.apply(s,{type:'shake',month:1}),null);
});
test('폭탄 세 장·더미 한 장·피 한 장·예약 두 회·더미만 선택',()=>{
 let s=fixture({hand:[0,1,2,16],table:[3,13],draw:8,captured:[[],[6]]});const stock=s.stock.length;
 s=G.apply(s,{type:'bomb',month:1});assert.equal(s.hands[0].length,1);assert.equal(s.stock.length,stock-1);assert.equal(s.skips[0],2);assert.ok([0,1,2,3,6].every(id=>s.captured[0].includes(id)));assert.deepEqual(s.shaken[0],[1]);
 s.turn=0;assert.ok(G.legal(s).some(a=>a.type==='skip'));s=G.apply(s,{type:'skip'});assert.equal(s.hands[0].length,1);assert.equal(s.skips[0],1);assert.equal(s.stock.length,stock-2);
});
test('고는 족보 7점과 증가 필요, 배수로 문턱 넘기 불가·마지막은 자동 스톱',()=>{
 const cap=pi.filter(id=>G.cards[id].pi===1).slice(0,16);let s=fixture();s.captured[0]=cap;s.hands[0]=[44,16];s.table=[];s.stock=[45,46];s=play(s,44);assert.equal(s.phase,'decision');s=G.apply(s,{type:'go'});assert.equal(s.go[0],1);assert.equal(s.lastGo[0],7);
 s.turn=0;s=play(s,16);assert.equal(s.phase,'play'); // 자기 족보 증가 없음, 상대가 남아 나가리 아직 아님
 s=fixture({hand:[44],table:[],draw:45,opp:[46],rest:false});s.captured[0]=cap;s=play(s,44);assert.equal(s.phase,'ended');assert.equal(s.result.winner,0);assert.equal(s.result.reason,'마지막 차례 스톱');
});
test('3뻑 고정 7점과 총통·양쪽 총통·바닥 총통 재분배',()=>{
 let s=fixture({hand:[0,16],table:[1],draw:2});s.ppukCount[0]=2;s=play(s,0);assert.equal(s.result.reason,'3뻑');assert.equal(s.result.total,7);
 const all=Array.from({length:48},(_,i)=>i); // 네 장 든 손을 의도 배치
 const both=[...all.slice(0,20),20,24,28,32,36,40,44,21,...all.filter(id=>id>=20&&![20,24,28,32,36,40,44,21].includes(id))];s=G.initial(both,0);assert.equal(s.result.reason,'양쪽 총통');
 const h=[0,1,2,3,4,8,12,16,20,24],opp=[5,9,13,17,21,25,29,33,37,41],t=[6,10,14,18,22,26,30,34],rest=all.filter(id=>![...h,...opp,...t].includes(id));s=G.initial([...h,...opp,...t,...rest],1);assert.equal(s.result.winner,0);assert.equal(s.result.total,7);
 const d=[...h,...opp,...[44,45,46,47,6,10,14,18],...all.filter(id=>![...h,...opp,44,45,46,47,6,10,14,18].includes(id))];assert.throws(()=>G.initial(d),/재분배/);
});
test('불법 행동 원본 불변·손상 저장/로그/배치/점수 조작 거절',()=>{
 const s=G.create(rng('valid')),before=G.clone(s);assert.equal(G.apply(s,{type:'play',id:99}),null);assert.deepEqual(s,before);assert.deepEqual(G.restore(s),s);
 for(const mutate of [x=>x.stock.reverse(),x=>x.go[0]=99,x=>x.captured[0].push(0),x=>x.log.push({type:'stop'}),x=>x.initial.deck.fill(0)]){const x=G.clone(s);mutate(x);assert.equal(G.restore(x),null);}
 assert.equal(G.restore({}),null);assert.equal(G.restore(null),null);
});
test('공정성: 비공개 손·더미 교환 및 시드·로그 변조가 AI 관측/판단에 영향 없음',()=>{
 let s=G.create(rng('fair'));while(s.turn!==1&&s.phase!=='ended')s=G.apply(s,AI.choose(G.view(s)));assert.equal(s.turn,1);
 const v=G.view(s),copy=G.clone(s);[copy.stock[0],copy.hands[0][0]]=[copy.hands[0][0],copy.stock[0]];copy.stock.reverse();copy.initial.deck.reverse();copy.log.push({secret:true});
 assert.deepEqual(G.view(copy),v);for(const l of ['easy','medium','hard'])assert.deepEqual(AI.choose(G.view(copy),l),AI.choose(v,l));
 for(const k of ['stock','hands','initial','log','seed','rng'])assert.ok(!Object.hasOwn(v,k));assert.equal(v.hand.length,s.hands[1].length);assert.equal(v.opponentCount,s.hands[0].length);
});
test('매일 1,095일 배치 재현·초기 카드 완전성, 3,000판 무작위/AI 완주와 매 행동 패 보존',()=>{
 for(let day=0;day<1095;day++){assert.deepEqual(G.create(M.dailyRandom('gostop','day-'+day)),G.create(M.dailyRandom('gostop','day-'+day)));}
 let shakes=0,bombs=0,choices=0,ppuk=0;for(let k=0;k<3000;k++){
   const random=rng('play'+k);let s=G.create(random),n=0;
   while(s.phase!=='ended'&&n++<150){const acts=G.legal(s);assert.ok(acts.length);const a=k%2?AI.choose(G.view(s),['easy','medium','hard'][k%3]):acts[Math.floor(random()*acts.length)];shakes+=a.type==='shake';bombs+=a.type==='bomb';choices+=a.type==='choose';s=G.apply(s,a);assert.deepEqual(owned(s),Array.from({length:48},(_,i)=>i));if(s.events.includes('뻑 · 세 장을 바닥에 남김'))ppuk++;}
   assert.ok(n<150);assert.ok(s.result);assert.ok(s.result.total>=0);if(k%20===0)assert.deepEqual(G.restore(s),s);
 }
 assert.ok(shakes>20&&bombs>20&&choices>100&&ppuk>100);
});

test('독립 짝 맞추기 모델: 손/더미의 같은 달 개수와 양쪽 선택 교차 비교',()=>{
 const mon=id=>Math.floor(id/4),sort=x=>[...x].sort((a,b)=>a-b),equal=(a,b)=>assert.deepEqual(sort(a),sort(b));
 // 점수/피 이동을 제외한 패 귀속을 독립적인 두 번의 맞추기 + 특수 예외로 계산.
 function reference(hand,ground,draw,hTarget,dTarget){
   let table=[...ground],cap=[];const matches=table.filter(i=>mon(i)===mon(hand));
   const pick=matches.length===3?matches:matches.length?[hTarget??matches[0]]:[];
   if(mon(hand)===mon(draw)&&matches.length===1)return {table:[...table,hand,draw],cap};
   if(mon(hand)===mon(draw)&&matches.length===2)return {table:table.filter(i=>mon(i)!==mon(hand)),cap:[hand,draw,...matches]};
   if(pick.length){table=table.filter(i=>!pick.includes(i));cap.push(hand,...pick);}else table.push(hand);
   const after=table.filter(i=>mon(i)===mon(draw)),take=after.length===3?after:after.length?[dTarget??after[0]]:[];
   if(take.length){table=table.filter(i=>!take.includes(i));cap.push(draw,...take);}else table.push(draw);
   return {table,cap};
 }
 let compared=0;
 for(let hand=0;hand<48;hand++)for(let draw=0;draw<48;draw++){if(draw===hand)continue;
   const candidates=Array.from({length:48},(_,i)=>i).filter(i=>i!==hand&&i!==draw&&(mon(i)===mon(hand)||mon(i)===mon(draw)));
   for(let mask=0;mask<(1<<candidates.length);mask++){
     const table=candidates.filter((_,i)=>mask&(1<<i)),other=Array.from({length:48},(_,i)=>i).find(i=>![hand,draw,...table].includes(i));
     const base=fixture({hand:[hand],opp:[other],table,draw}),pending=play(base,hand),hChoices=pending.phase==='choose'&&pending.pending.kind==='hand'?pending.pending.choices:[null];
     for(const hc of hChoices){const mid=hc===null?pending:G.apply(pending,{type:'choose',id:hc}),dChoices=mid.phase==='choose'?mid.pending.choices:[null];
       for(const dc of dChoices){const s=dc===null?mid:G.apply(mid,{type:'choose',id:dc}),r=reference(hand,table,draw,hc,dc);equal(s.table,r.table);equal(s.captured[0],r.cap);compared++;}
     }
   }
 }
 assert.ok(compared>100000);console.log('독립 짝 맞추기 비교',compared,'건');
});
