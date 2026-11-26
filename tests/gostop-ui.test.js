const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../gostop/js/logic'),AI=require('../gostop/js/ai'),M=require('../common/core'),dom=require('./helpers/game-dom');
const KEY='maeil-game.gostop.game.v1',STATS='maeil-game.gostop.stats.v1';
function wrap(s,extras={}){return {v:1,id:'ui-'+s.initial.deck.slice(0,6).join('-'),difficulty:'medium',daily:null,undo:0,hints:0,state:s,...extras};}
function state(seed,first=0){let s=G.create(M.createSeededRandom(seed));if(s.phase!=='ended'){s=G.initial(s.initial.deck,first);}return s;}
function browser(s,options={}){return dom('gostop',{saved:{[KEY]:wrap(s)},...options});}
function handCard(b,id){const s=b.get(KEY).state,list=[...s.hands[0]].sort((a,b)=>a-b),card=b.element('hand').children[list.indexOf(id)];assert.ok(card,`손패에 ${id}번 패가 있어야 합니다`);return card;}
function clickHand(b,id){handCard(b,id).fire('click');}
function act(b,a){if(a.type==='play'){clickHand(b,a.id);b.click('play-btn');}else if(a.type==='choose'){const choices=b.get(KEY).state.pending.choices;b.element('choices').children[choices.indexOf(a.id)].fire('click');}else if(a.type==='stop'||a.type==='go')b.click(a.type+'-btn');else if(a.type==='skip')b.click('skip-btn');else {const actions=G.legal(b.get(KEY).state).filter(x=>['shake','bomb'].includes(x.type));b.element('special-actions').children[actions.findIndex(x=>JSON.stringify(x)===JSON.stringify(a))].fire('click');}}
function human(b){act(b,AI.choose(G.view(b.get(KEY).state)));}
function finish(b){for(let n=0;n<160&&b.element('result-screen').hidden;n++){const v=b.get(KEY);assert.ok(v);if(b.element('game-screen').attributes['aria-busy']==='true'||v.state.turn===1)b.advance(700);else human(b);}assert.equal(b.element('result-screen').hidden,false);}

test('손패 10장·한 번 눌러 선택/다른 패로 변경/선택 취소 버튼·내기 전 저장 변화 없음',()=>{
 const s=state('selection'),b=browser(s);b.click('continue-btn');const before=b.get(KEY),[id,other]=s.hands[0];
 const selected=()=>b.element('hand').children.filter(card=>card.attributes['aria-pressed']==='true');
 assert.equal(b.element('hand').children.length,10);assert.equal(b.element('play-btn').disabled,true);assert.equal(b.element('clear-btn').disabled,true);assert.equal(selected().length,0);
 clickHand(b,id);assert.equal(b.element('play-btn').disabled,false);assert.equal(b.element('clear-btn').disabled,false);assert.deepEqual(selected(),[handCard(b,id)]);assert.deepEqual(b.get(KEY),before);
 clickHand(b,other);assert.equal(handCard(b,id).attributes['aria-pressed'],'false');assert.deepEqual(selected(),[handCard(b,other)]);assert.equal(b.element('play-btn').disabled,false);assert.equal(b.element('clear-btn').disabled,false);assert.deepEqual(b.get(KEY),before);
 b.click('clear-btn');assert.equal(selected().length,0);assert.equal(b.element('play-btn').disabled,true);assert.equal(b.element('clear-btn').disabled,true);assert.equal(b.element('hand').children.length,10);assert.deepEqual(b.get(KEY),before);
 b.click('play-btn');assert.deepEqual(b.get(KEY),before);
 clickHand(b,id);assert.deepEqual(selected(),[handCard(b,id)]);assert.deepEqual(b.get(KEY),before);b.click('play-btn');assert.deepEqual(b.get(KEY),{...before,state:G.apply(s,{type:'play',id})});assert.ok(G.restore(b.get(KEY).state));
});
for(const [name,event] of [['같은 손패를 두 번 눌러','click'],['손패를 더블클릭해','dblclick']])test(`${name} 정확히 한 장 내기`,()=>{
 const s=state('selection'),b=browser(s);b.click('continue-btn');const before=b.get(KEY),id=s.hands[0][0];
 if(event==='click'){clickHand(b,id);assert.deepEqual(b.get(KEY),before);assert.equal(b.element('hand').children.length,10);assert.equal(handCard(b,id).attributes['aria-pressed'],'true');}
 handCard(b,id).fire(event);const after=b.get(KEY);assert.deepEqual(after,{...before,state:G.apply(s,{type:'play',id})});assert.equal(after.state.hands[0].length,9);assert.equal(after.state.hands[0].includes(id),false);assert.equal(b.element('hand').children.length,9);assert.equal(b.element('play-btn').disabled,true);assert.equal(b.element('clear-btn').disabled,true);assert.ok(G.restore(after.state));
});
test('컴퓨터 차례 취소·한 차례 무르기·늦은 타이머 무시와 더미 복원',()=>{
 const s=state('undo'),b=browser(s);b.click('continue-btn');human(b);b.advance(650);b.click('undo-btn');const restored=b.get(KEY);assert.deepEqual(restored.state,s);assert.equal(restored.undo,1);b.advance(6000);assert.deepEqual(b.get(KEY),restored);
 human(b);b.advance(7000);if(b.element('result-screen').hidden){b.click('undo-btn');assert.deepEqual(b.get(KEY).state,s);}
});
test('처음·이어하기·선택 도중과 컴퓨터 차례 자동 재개',()=>{
 const s=state('continue',1),b=browser(s);b.click('continue-btn');b.click('home-btn');const before=b.get(KEY);b.advance(7000);assert.deepEqual(b.get(KEY),before);assert.equal(b.element('continue-wrap').hidden,false);b.click('continue-btn');b.advance(7000);assert.equal(b.get(KEY).state.turn,0);
 const c=dom('gostop',{saved:{[KEY]:b.get(KEY)}});c.click('continue-btn');assert.deepEqual(c.get(KEY),b.get(KEY));
});
test('일시정지·탭 숨김·pagehide·bfcache는 진행과 컴퓨터 멈춤',()=>{
 const b=browser(state('pause',1));b.click('continue-btn');b.click('pause-btn');const before=b.get(KEY);b.advance(9000);assert.deepEqual(b.get(KEY),before);assert.equal(b.element('pause-overlay').hidden,false);b.click('resume-btn');b.advance(7000);assert.equal(b.get(KEY).state.turn,0);
 b.document.hidden=true;b.document.fire('visibilitychange');assert.equal(b.element('pause-overlay').hidden,false);b.click('resume-btn');b.window.fire('pagehide');b.window.fire('pageshow',{persisted:true});assert.equal(b.element('pause-overlay').hidden,false);
});
test('추천은 실행 전 선택만 표시, 큰 글씨·어두운 화면·회전은 진행 유지',()=>{
 const b=browser(state('hint'));b.click('continue-btn');const before=b.get(KEY).state;b.click('hint-btn');assert.equal(b.get(KEY).hints,1);assert.deepEqual(b.get(KEY).state,before);
 b.document.querySelectorAll('.large-text-toggle')[0].fire('click');b.document.querySelectorAll('.dark-toggle')[0].fire('click');b.window.fire('resize');assert.deepEqual(b.get(KEY).state,before);
});
test('오늘 도전 날짜 재현·완주/출석·단일 기록·재도전 같은 배치',()=>{
 const b=dom('gostop',{hash:'#daily'}),initial=b.get(KEY).state.initial;finish(b);const stats=b.get(STATS);assert.equal(stats.daily.played,1);assert.ok(b.get('maeil-game.daily.v1').done['2026-11-23'].includes('gostop'));
 b.window.fire('pagehide');b.click('undo-btn');assert.deepEqual(b.get(STATS),stats);assert.equal(b.get(KEY),null);b.click('again-btn');assert.deepEqual(b.get(KEY).state.initial,initial);
});
test('기권 두 번·5초 확인 만료, 기권은 오늘 출석 제외',()=>{
 const b=dom('gostop',{hash:'#daily'});b.click('resign-btn');assert.equal(b.element('result-screen').hidden,true);b.advance(5100);assert.equal(b.element('resign-btn').textContent,'기권');b.click('resign-btn');b.click('resign-btn');assert.equal(b.element('result-screen').hidden,false);assert.equal(b.get('maeil-game.daily.v1'),null);assert.equal(b.get(STATS).daily.played,1);
});
test('손상 저장 무시·저장 차단이어도 한 판 종료',()=>{
 for(const value of [{},{state:{}},wrap({...state('bad'),go:[99,99]})]){const b=dom('gostop',{saved:{[KEY]:value}});assert.equal(b.element('continue-wrap').hidden,true);}
 const b=dom('gostop',{blockedStorage:true});b.click('start-btn');assert.equal(b.element('storage-warning').hidden,false);b.click('resign-btn');b.click('resign-btn');assert.equal(b.element('result-screen').hidden,false);
});
test('실제 선택/고 판단 단계 저장과 이어하기, 양쪽 승·무승부 결과 기록',()=>{
 const found={};for(let k=0;k<100&&Object.keys(found).length<4;k++){let s=state('flow'+k);if(s.phase==='ended')continue;for(let n=0;n<100&&s.phase!=='ended';n++){
   if(s.turn===0&&['choose','decision'].includes(s.phase)&&!found[s.phase])found[s.phase]=s;
   s=G.apply(s,AI.choose(G.view(s)));
 }if(s.result&&!found['result'+s.result.winner])found['result'+s.result.winner]=k;}
 for(const phase of ['choose','decision']){assert.ok(found[phase]);const b=browser(found[phase]);b.click('continue-btn');assert.equal(b.element(phase==='choose'?'choice-panel':'decision-panel').hidden,false);const before=b.get(KEY);b.click('home-btn');b.click('continue-btn');assert.deepEqual(b.get(KEY),before);human(b);assert.ok(b.get(KEY)===null||G.restore(b.get(KEY).state));}
 for(const winner of [0,1]){assert.ok(found['result'+winner]!==undefined);const s=state('flow'+found['result'+winner]),b=browser(s);b.click('continue-btn');finish(b);assert.equal(b.get(STATS).medium.played,1);assert.equal(b.get(STATS).medium.wins,winner===0?1:0);}
});

test('고 뒤 점수 미증가 나가리도 정상 완주·무승부 단일 기록',()=>{
 let prior=null;for(let k=0;k<100&&!prior;k++){let s=state('draw'+k);if(s.phase==='ended')continue;for(let n=0;n<150&&s.phase!=='ended';n++){const a=s.phase==='decision'?(G.legal(s).find(a=>a.type==='go')||{type:'stop'}):AI.choose(G.view(s));const next=G.apply(s,a);if(next.result?.winner===null){prior=s;break;}s=next;}}
 assert.ok(prior);const b=browser(prior);b.click('continue-btn');finish(b);assert.equal(b.get(STATS).medium.draws,1);assert.equal(b.get(STATS).medium.wins,0);
});
