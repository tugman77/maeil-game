const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../gostop/js/logic'),AI=require('../gostop/js/ai'),P=require('../gostop/js/presentation'),M=require('../common/core'),dom=require('./helpers/game-dom');
const KEY='maeil-game.gostop.game.v1',PREF='maeil-game.gostop.playback.v1',STATS='maeil-game.gostop.stats.v1';
const wrap=s=>({v:1,id:'presentation-test',difficulty:'medium',daily:null,undo:0,hints:0,state:s});
function find(predicate){for(let k=0;k<100;k++){let s=G.create(M.createSeededRandom('presentation'+k));for(let n=0;n<100&&s.phase!=='ended';n++){const a=AI.choose(G.view(s)),next=G.apply(s,a);if(predicate(s,a,next))return {s,a,next};s=next;}}throw Error('검사 배치 없음');}
const simple=()=>find((s,a,n)=>s.turn===0&&a.type==='play'&&n.turn===1&&n.events.length===2&&n.captured[0].length>s.captured[0].length);
function open(s,pref){const b=dom('gostop',{saved:{[KEY]:wrap(s),[PREF]:pref}});b.click('continue-btn');return b;}
function play(b,a){const s=b.get(KEY).state;const index=[...s.hands[0]].sort((x,y)=>x-y).indexOf(a.id);b.element('hand').children[index].fire('click');b.click('play-btn');}
function duration(frames,speed='normal'){const t=P.speeds[speed];return frames.reduce((n,f)=>n+(f.kind==='reveal'?t.reveal:['event','speech'].includes(f.kind)?t.event:t.move)+16,0);}

test('차례 표시: 내기 → 1초 더미 공개 → 바닥 이동 → 획득, 상태 원본 불변',()=>{
 const {s,a,next}=simple(),original=G.clone(s),after=G.clone(next),p=P.plan(s,a,next);
 assert.deepEqual(p.frames.map(f=>f.kind),['play','reveal','place','capture']);
 assert.equal(p.frames[0].state.hands[0].includes(a.id),false);assert.equal(p.frames[0].state.lastDraw,s.lastDraw);
 assert.deepEqual(p.frames[1].ids,[s.stock[0]]);assert.match(p.frames[1].text,/더미에서 \d+월/);
 assert.equal(p.frames[1].state.stock.length,s.stock.length);assert.equal(p.frames[2].state.stock.length,next.stock.length);
 assert.deepEqual(p.frames[3].state.captured,s.captured);assert.deepEqual(s,original);assert.deepEqual(next,after);
 assert.match(p.text,/나:.*먹음.*더미/);
});
test('더미 공개 전 바닥 선택·뒤집은 패 선택 이후 획득, 특수 사건과 피 받기 연출',()=>{
 const h=find((s,a,n)=>a.type==='play'&&n.phase==='choose'&&n.pending.kind==='hand');
 assert.deepEqual(P.plan(h.s,h.a,h.next).frames.map(f=>f.kind),['play']);
 const chosen=G.apply(h.next,{type:'choose',id:h.next.pending.choices[0]});assert.equal(P.plan(h.next,{type:'choose',id:h.next.pending.choices[0]},chosen).frames[0].kind,'reveal');
 const d=find((s,a,n)=>n.phase==='choose'&&n.pending.kind==='draw'),choice={type:'choose',id:d.next.pending.choices[0]},next=G.apply(d.next,choice);
 assert.ok(P.plan(d.next,choice,next).frames.some(f=>f.kind==='capture'));assert.ok(!P.plan(d.next,choice,next).frames.some(f=>f.kind==='reveal'));
 for(const word of ['쪽','뻑','따닥','쓸','폭탄','흔들기','상대 피']){const v=find((s,a,n)=>P.plan(s,a,n).frames.some(f=>f.kind==='event'&&f.text.includes(word)));assert.ok(v);}
});
test('연출 중 모든 게임 입력 차단·즉시 저장·더미 공개 유지 시간',()=>{
 const {s,a,next}=simple(),b=open(s);play(b,a);const saved=b.get(KEY);
 assert.deepEqual(saved.state,next);assert.ok(G.restore(saved.state));assert.equal(b.element('turn-stage').dataset.kind,'play');
 for(const id of ['play-btn','clear-btn','hint-btn','undo-btn','replay-btn','resign-btn','speed-select','reduce-motion'])assert.equal(b.element(id).disabled,true,id);
 for(const c of b.element('hand').children)assert.equal(c.disabled,true);
 b.click('play-btn');b.click('skip-btn');b.click('go-btn');b.click('stop-btn');b.click('undo-btn');b.element('hand').children[0].fire('dblclick');assert.deepEqual(b.get(KEY),saved);
 b.advance(600);assert.equal(b.element('turn-stage').dataset.kind,'reveal');assert.equal(b.element('stage-cards').children.length,1);
 b.advance(990);assert.equal(b.element('turn-stage').dataset.kind,'reveal');b.advance(32);assert.equal(b.element('turn-stage').dataset.kind,'place');
});
test('상대 이름·얼굴·뒷면 손 장수·점수·고·흔들기·생각 중과 양쪽 종류별 무더기·족보 진행',()=>{
 const v=find(s=>s.turn===1&&s.captured.flat().length>20),b=open(v.s);
 assert.match(b.element('cpu-thinking').textContent,/생각 중/);assert.ok(b.element('cpu-seat').classList.contains('active-seat'));
 assert.equal(b.element('cpu-hand').children.length,v.s.hands[1].length);for(const back of b.element('cpu-hand').children)assert.equal(back.src,'cards/Hwatu_back.svg');
 for(const [p,prefix] of [[0,'my'],[1,'cpu']]){
   assert.equal(b.element(prefix+'-score').textContent,G.score(v.s.captured[p]).total+'점');assert.match(b.element(prefix+'-meta').textContent,/고 · 흔들기 .*회 · 손/);
   const piles=b.element(prefix+'-captured').children;assert.deepEqual(piles.map(g=>g.dataset.type),['광','열','띠','피']);
   for(const pile of piles){const count=v.s.captured[p].filter(i=>G.cards[i].type===pile.dataset.type).length;assert.match(pile.attributes['aria-label'],new RegExp(count+'장'));assert.equal(pile.children[1].children.filter(c=>c.className.split(' ').includes('hwatu')).length,count);}
   for(const name of ['홍단','청단','초단','고도리'])assert.ok(b.element(prefix+'-sets').textContent.includes(name));
 }
 const fs=require('node:fs'),html=fs.readFileSync(require('node:path').join(__dirname,'../gostop/index.html'),'utf8');
 assert.ok(html.includes('class="face-icon"'));assert.ok(html.indexOf('id="cpu-captured"')<html.indexOf('id="table"'));assert.ok(html.indexOf('id="my-captured"')>html.indexOf('id="table"'));assert.ok(!html.includes('captured-details'));
});
test('보통 기본·느리게/빠르게 저장·컴퓨터 대기와 더미 공개에 같은 속도 적용',()=>{
 const {s,a,next}=simple();
 for(const speed of ['normal','slow','fast']){
   const b=open(s);assert.equal(b.element('speed-select').value,'normal');b.element('speed-select').value=speed;b.element('speed-select').fire('change');assert.equal(b.get(PREF).speed,speed);assert.deepEqual(b.get(KEY).state,s);
   play(b,a);b.advance(P.speeds[speed].move+16);assert.equal(b.element('turn-stage').dataset.kind,'reveal');b.advance(P.speeds[speed].reveal-32);assert.equal(b.element('turn-stage').dataset.kind,'reveal');
   const cpu=open(next,{speed});cpu.advance(P.speeds[speed].think-20);assert.equal(cpu.element('turn-stage').hidden,true);cpu.advance(40);assert.equal(cpu.element('turn-stage').hidden,false);
   const reload=open(s,b.get(PREF));assert.equal(reload.element('speed-select').value,speed);
 }
 assert.equal(open(s,{speed:'invalid'}).element('speed-select').value,'normal');
});
test('움직임 줄이기 환경설정 기본값·저장 보존·단계와 공개 시간 유지',()=>{
 const {s,a}=simple(),b=dom('gostop',{saved:{[KEY]:wrap(s)},beforeUI:"matchMedia=()=>({matches:true});"});b.click('continue-btn');assert.equal(b.element('reduce-motion').checked,true);
 b.element('reduce-motion').checked=false;b.element('reduce-motion').fire('change');assert.deepEqual(b.get(PREF),{speed:'normal',reduceMotion:false});b.element('reduce-motion').checked=true;b.element('reduce-motion').fire('change');play(b,a);
 assert.ok(b.element('game-screen').classList.contains('reduced-motion'));b.advance(616);assert.equal(b.element('turn-stage').dataset.kind,'reveal');assert.ok(open(s,b.get(PREF)).element('reduce-motion').checked);
});
test('직전 차례 전체 다시 보기·한 줄 기록·점수/로그/통계/추천 불변·컴퓨터 타이머 충돌 없음',()=>{
 const {s,a,next}=simple(),b=open(next),before=b.get(KEY),stats=b.get(STATS),turn=P.lastTurn(next);
 assert.ok(turn.length);assert.equal(b.element('replay-btn').disabled,false);assert.match(b.element('turn-log').textContent,/나:.*더미/);b.click('replay-btn');assert.match(b.element('game-status').textContent,/다시 보기/);
 b.advance(duration(turn.flatMap(t=>P.plan(t.before,t.action,t.after).frames)));assert.deepEqual(b.get(KEY),before);assert.deepEqual(b.get(STATS),stats);
 assert.equal(b.element('turn-stage').hidden,true);b.advance(700);assert.ok(b.get(KEY).state.log.length>before.state.log.length);
});
test('연출 도중 처음·새로고침·일시정지·탭 숨김 후 권위 상태로 재개, 오래된 타이머 취소',()=>{
 const {s,a,next}=simple();
 for(const interruption of ['home','pause','pagehide']){
   const b=open(s);play(b,a);b.advance(616);assert.equal(b.element('turn-stage').dataset.kind,'reveal');
   if(interruption==='home')b.click('home-btn');else if(interruption==='pause')b.click('pause-btn');else b.window.fire('pagehide');
   const saved=b.get(KEY);b.advance(20000);assert.deepEqual(b.get(KEY),saved);assert.deepEqual(saved.state,next);
   if(interruption==='home')b.click('continue-btn');else b.click('resume-btn');assert.equal(b.element('turn-stage').hidden,true);
   const reload=open(saved.state);assert.deepEqual(reload.get(KEY).state,next);reload.advance(7000);assert.ok(G.restore(reload.get(KEY).state));
 }
});
test('컴퓨터 고/스톱 말풍선·종료 연출 도중 재접속도 결과 한 번만 기록',()=>{
 for(const type of ['go','stop']){
   const {s}=find((s,a)=>s.turn===1&&s.phase==='decision'),next=G.apply(s,{type});
   const plan=P.plan(s,{type},next);assert.ok(plan.frames.some(f=>f.kind==='speech'&&f.text===(type==='go'?'고!':'스톱!')));
 }
 const {s}=find(s=>s.turn===1&&s.phase==='decision'),b=open(s);b.advance(670);
 assert.equal(b.get(KEY).state.phase,'ended');assert.equal(b.element('result-screen').hidden,true);assert.equal(b.element('cpu-speech').hidden,false);assert.equal(b.element('cpu-speech').textContent,'스톱!');
 const saved=b.get(KEY);b.click('pause-btn');b.advance(10000);assert.equal(b.get(STATS),null);b.click('resume-btn');assert.equal(b.get(STATS).medium.played,1);
 const reload=dom('gostop',{saved:{[KEY]:saved}});reload.click('continue-btn');assert.equal(reload.element('result-screen').hidden,false);assert.equal(reload.get(STATS).medium.played,1);reload.window.fire('pagehide');assert.equal(reload.get(STATS).medium.played,1);
});

test('선택을 기다리는 동안 낸 패와 뒤집은 패가 바닥에서 사라지지 않음',()=>{
 for(const kind of ['hand','draw']){
   const {next}=find((s,a,n)=>n.turn===0&&n.phase==='choose'&&n.pending.kind===kind),b=open(next);
   const names=b.element('table').children.map(c=>c.attributes['aria-label']);
   assert.ok(names.includes(G.cards[next.tx.played].name));
   if(kind==='hand'){assert.equal(b.element('last-draw').textContent,'');assert.equal(b.element('turn-stage').hidden,true);assert.ok(!names.includes(G.cards[next.stock[0]].name));}
   else assert.ok(names.includes(G.cards[next.tx.draw].name));
 }
});
test('컴퓨터 고 선택은 사건 알림 뒤 고 말풍선을 표시',()=>{
 const {s}=find(s=>s.turn===1&&s.phase==='decision');
 const b=dom('gostop',{saved:{[KEY]:wrap(s)},beforeUI:"GostopAI.choose=()=>({type:'go'});"});b.click('continue-btn');b.advance(1700);
 assert.equal(b.element('cpu-speech').hidden,false);assert.equal(b.element('cpu-speech').textContent,'고!');assert.equal(b.get(KEY).state.go[1],s.go[1]+1);
});

test('실제 두 번 클릭 뒤 늦은 dblclick 이벤트가 선택을 되살리거나 패를 더 내지 않음',()=>{
 const {s,a}=simple(),b=open(s),index=[...s.hands[0]].sort((x,y)=>x-y).indexOf(a.id);
 b.element('hand').children[index].fire('click');const selected=b.element('hand').children[index];selected.fire('click');const saved=b.get(KEY);
 selected.fire('dblclick');selected.fire('click');assert.deepEqual(b.get(KEY),saved);b.advance(616);
 assert.equal(b.element('selected-info').textContent,'선택한 패는 내기 버튼으로도 낼 수 있어요.');assert.equal(b.element('play-btn').disabled,true);
});

test('컴퓨터 보통 속도: 생각 650ms → 내기 600ms → 더미 공개 1000ms → 바닥 이동 → 획득',()=>{
 const {s,a,next}=find((s,a,n)=>s.turn===1&&a.type==='play'&&n.turn===0&&n.events.length===2&&n.captured[1].length>s.captured[1].length);
 const b=open(s),saved=b.get(KEY);assert.match(b.element('cpu-thinking').textContent,/생각 중/);
 b.advance(649);assert.deepEqual(b.get(KEY),saved);assert.equal(b.element('turn-stage').hidden,true);
 b.advance(1);assert.equal(b.element('turn-stage').dataset.actor,'1');assert.equal(b.element('turn-stage').dataset.kind,'play');
 assert.equal(P.speeds.normal.move,600);assert.equal(P.speeds.normal.reveal,1000);
 b.advance(599);assert.equal(b.element('turn-stage').dataset.kind,'play');
 b.advance(1);assert.equal(b.element('turn-stage').dataset.kind,'reveal');
 b.advance(999);assert.equal(b.element('turn-stage').dataset.kind,'reveal');
 b.advance(1);assert.equal(b.element('turn-stage').dataset.kind,'place');
 b.advance(600);assert.equal(b.element('turn-stage').dataset.kind,'capture');
 b.advance(600);assert.equal(b.element('turn-stage').hidden,true);assert.equal(b.get(KEY).state.turn,0);
});
test('빈 먹은 패는 무더기 없이 한 줄로 접고 획득한 종류만 펼침',()=>{
 const {s}=simple(),b=open(s);
 for(const prefix of ['my','cpu'])for(const pile of b.element(prefix+'-captured').children){
 const count=s.captured[prefix==='my'?0:1].filter(i=>G.cards[i].type===pile.dataset.type).length;
 assert.equal(pile.classList.contains('is-empty'),count===0);
 }
});
