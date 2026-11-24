// 실제 core/start/deals/logic/ui 실행. 실제 브라우저 카드 배치·터치는 별도 확인 대상이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../freecell/js/logic.js');
const M = require('../common/core.js');
const dom = require('./helpers/game-dom.js');
const Table = require('../common/card-table.js');
const GAME = 'maeil-game.freecell.game.v1', STATS = 'maeil-game.freecell.stats.v1', DAILY = 'maeil-game.freecell.daily.v1';
const browser = (options = {}) => dom('freecell', { scripts:['common/card-table.js','freecell/js/deals.js'], ...options });
test('좁은 가로·세로 화면의 전체보기 계산과 큰 선택 창 분리', () => {
  for(const [w,h] of [[360,800],[390,844],[667,320],[740,360],[844,390]]) {
    const layout=Table.layout(w,h,8,7);
    assert.equal(layout.columns,8);assert.equal(layout.landscape,w>h);assert.ok(layout.step>=44);
  }
  const b=browser();b.click('start-btn');const before=b.get(GAME);
  b.element('column-buttons').children[0].fire('click');
  assert.equal(b.element('card-picker').hidden,false);assert.equal(b.element('game-screen').inert,true);
  assert.equal(b.element('card-picker-list').children.length,before.columns[0].length);
  b.click('card-picker-close');assert.equal(b.element('game-screen').inert,false);assert.deepEqual(b.get(GAME),before);
});
test('화면 회전은 카드·선택·이어하기 상태를 바꾸지 않음',()=>{
  const b=browser();b.click('start-btn');b.click('hint-btn');const before=b.get(GAME),selection=b.element('selection-info').textContent;
  b.window.fire('resize');assert.deepEqual(b.get(GAME),before);assert.equal(b.element('selection-info').textContent,selection);
  assert.equal(b.element('column-buttons').children.length,8);
});
function point(b, p) {
  if (p.type === 'foundation') return b.element('foundations').children[p.index];
  if (p.type === 'free') return b.element('free-cells').children[p.index];
  const column=b.element('tableau').children[p.index];
  return p.start===undefined?column.children.at(-1):column.children[p.start+1];
}
function play(b, move) { point(b,move.from).fire('click'); point(b,move.to).fire('click'); }
function almostDone(daily = null) {
  const s=G.create('medium',{daily,dealNumber:234});
  for (const m of s.solution.slice(0,-1)) G.move(s,m.from,m.to);
  return s;
}

test('보통 시작·52장·프리셀/완성 칸 각각 4개·8줄·시간은 아직 정지', () => {
  const b=browser(); assert.equal(b.element('game-screen').hidden,true); b.click('start-btn');
  const s=b.get(GAME); assert.ok(G.isValid(s)); assert.equal(s.difficulty,'medium');
  assert.equal(b.element('free-cells').children.length,4); assert.equal(b.element('foundations').children.length,4);
  assert.equal(b.element('tableau').children.length,8);
  assert.equal(b.element('tableau').children.reduce((n,c)=>n+c.children.length-1,0),52);
  b.advance(2000); assert.equal(b.element('timer').textContent,'00:00');
});

test('선택·취소·목적지 강조·이동·되돌리기', () => {
  const b=browser();b.click('start-btn');const before=b.get(GAME), m=before.solution[0];
  point(b,m.from).fire('click'); assert.equal(b.get(GAME).moves,0);assert.equal(b.element('cancel-btn').disabled,false);
  assert.match(point(b,m.to).attributes['aria-label']||'',/이동 가능/);
  b.click('cancel-btn');assert.equal(b.element('cancel-btn').disabled,true);
  play(b,m); assert.equal(b.get(GAME).moves,1);
  const expected=G.snapshot(before);G.apply(expected,m.from,m.to);assert.deepEqual(G.snapshot(b.get(GAME)),expected);
  b.click('undo-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(before));assert.equal(b.get(GAME).undoUsed,1);
});

test('규칙에 맞지 않는 목적지는 판을 바꾸지 않고 이유를 설명', () => {
  const b=browser();b.click('start-btn');const s=b.get(GAME);
  const from={type:'column',index:0,start:s.columns[0].length-1};
  point(b,from).fire('click');
  point(b,{type:'foundation',index:(G.suit(s.columns[0].at(-1))+1)%4}).fire('click');
  assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(s));assert.match(b.element('game-status').textContent,/같은 무늬/);
});

test('여러 장 묶음 선택·이동과 한 번 되돌리기', () => {
  const state=G.create('medium',{dealNumber:123});let move;
  for(const m of state.solution) {
    if(G.sourceCards(state,m.from).length>1){move=m;break;}
    G.move(state,m.from,m.to);
  }
  assert.ok(move);const b=browser({saved:{[GAME]:state}});b.click('continue-btn');
  point(b,move.from).fire('click');assert.match(b.element('selection-info').textContent,/장 선택/);
  point(b,move.to).fire('click');assert.equal(b.get(GAME).moves,state.moves+1);
  b.click('undo-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(state));
});

test('추천은 선택·목적지만 표시, 누르기 전에는 이동하지 않음', () => {
  const b=browser();b.click('start-btn');const before=b.get(GAME), m=G.hint(before,G.solutionMap(before));
  b.click('hint-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(before));assert.equal(b.get(GAME).hintsUsed,1);
  assert.match(b.element('game-status').textContent,/옮겨 보세요/);
  point(b,m.to).fire('click');assert.equal(b.get(GAME).moves,1);
});

test('자동 정리 여러 장과 되돌리기', () => {
  const state=G.create('easy',{dealNumber:19});
  for(const m of state.solution){if(G.safeMove(state))break;G.move(state,m.from,m.to);}
  const b=browser({saved:{[GAME]:state}});b.click('continue-btn');b.click('auto-btn');
  assert.ok(G.foundationCount(b.get(GAME))>G.foundationCount(state));
  b.click('undo-btn');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(state));
});

test('같은 판 초기화는 두 번 눌러 확인하고 판 번호·배치는 유지', () => {
  const b=browser();b.click('start-btn');const before=b.get(GAME);play(b,before.solution[0]);
  b.click('restart-btn');assert.equal(b.get(GAME).moves,1);assert.match(b.element('restart-btn').textContent,/한 번 더/);
  b.advance(4100);assert.equal(b.element('restart-btn').textContent,'처음 배치');assert.equal(b.get(GAME).moves,1);
  b.click('restart-btn');b.click('restart-btn');
  assert.equal(b.get(GAME).moves,0);assert.equal(b.get(GAME).dealNumber,before.dealNumber);
  assert.deepEqual(b.get(GAME).initial,before.initial);
});

test('일시정지·키보드 Escape·앱 숨김·저장 후 이어하기', () => {
  const b=browser();b.click('start-btn');play(b,b.get(GAME).solution[0]);b.advance(1500);
  b.key('Escape');assert.equal(b.element('pause-overlay').hidden,false);const paused=b.get(GAME);
  b.advance(4000);b.click('auto-btn');assert.deepEqual(b.get(GAME),paused);
  b.key('Escape');assert.equal(b.element('pause-overlay').hidden,true);
  b.advance(1000);b.document.hidden=true;b.document.fire('visibilitychange');
  assert.equal(b.element('play-area').inert,true);const saved=b.get(GAME);
  const reopened=browser({saved:{[GAME]:saved}});reopened.click('continue-btn');
  assert.deepEqual(G.snapshot(reopened.get(GAME)),G.snapshot(saved));
  reopened.window.fire('pagehide');reopened.window.fire('pageshow',{persisted:true});
  assert.equal(reopened.element('pause-overlay').hidden,false);
});

test('오늘의 도전 링크는 같은 판 번호와 배치·검증 수순', () => {
  const a=browser({hash:'#daily'}),b=browser({hash:'#daily'});
  assert.equal(a.get(GAME).daily,'2026-11-23');assert.deepEqual(a.get(GAME),b.get(GAME));
  assert.equal(a.element('game-screen').hidden,false);
});

test('검증 수순 전체를 실제 화면에서 끝까지 진행하고 통계·공유 화면 표시', () => {
  const b=browser();b.click('start-btn');const initial=b.get(GAME);
  for(const m of initial.solution)play(b,m);
  assert.equal(b.element('result-screen').hidden,false);assert.equal(b.get(GAME),null);
  assert.equal(b.get(STATS).medium.played,1);assert.equal(b.get(STATS).medium.best.moves,initial.solution.length);
  b.window.fire('pagehide');b.advance(1000);assert.equal(b.get(STATS).medium.played,1);
  b.click('again-btn');assert.equal(b.get(GAME).moves,0);assert.deepEqual(b.get(GAME).initial,initial.initial);
});

test('오늘 완료와 지난날 완료를 구분하고 최신 날짜 기록을 보존', () => {
  const state=almostDone('2026-11-23');const b=browser({saved:{[GAME]:state}});b.click('continue-btn');play(b,state.solution.at(-1));
  assert.equal(b.element('result-screen').hidden,false);assert.ok(b.get('maeil-game.daily.v1').done['2026-11-23'].includes('freecell'));
  const latest={date:'2026-11-23',moves:200,seconds:500,hints:0,undos:0};
  const old=almostDone('2026-11-22'),c=browser({saved:{[GAME]:old,[DAILY]:latest}});c.click('continue-btn');play(c,old.solution.at(-1));
  assert.deepEqual(c.get(DAILY),latest);
});

test('막힌 저장 판 안내와 초기화, 손상 저장 무시', () => {
  const state=G.create('medium',{dealNumber:42}), tops=[11,24,37,50,9,22,35,48], kings=[12,25,38,51];
  const remaining=Array.from({length:52},(_,i)=>i).filter((n)=>!tops.includes(n)&&!kings.includes(n));
  state.columns=Array.from({length:8},(_,i)=>[...remaining.slice(i*5,i*5+5),tops[i]]);state.free=kings;
  assert.ok(G.validPosition(state));assert.equal(G.legalMoves(state).length,0);assert.ok(G.isValid(state));
  const b=browser({saved:{[GAME]:state}});b.click('continue-btn');assert.match(b.element('game-status').textContent,/가능한 이동이 없어요/);
  assert.equal(b.element('hint-btn').disabled,true);b.click('restart-btn');b.click('restart-btn');assert.ok(G.legalMoves(b.get(GAME)).length);
  const bad=browser({saved:{[GAME]:{columns:[]},[STATS]:'손상'}});assert.equal(bad.element('continue-wrap').hidden,true);bad.click('start-btn');assert.ok(G.isValid(bad.get(GAME)));
});

test('저장소가 차단되어도 시작·추천·이동·일시정지 가능', () => {
  const b=browser({blockedStorage:true});b.click('start-btn');assert.equal(b.element('game-screen').hidden,false);
  b.click('hint-btn');assert.match(b.element('selection-info').textContent,/선택/);
  const target=b.element('free-cells').children.find((el)=>el.className.includes('hint-target'))
    || b.element('foundations').children.find((el)=>el.className.includes('hint-target'))
    || b.element('tableau').children.flatMap(c=>c.children).find(el=>el.className.includes('hint-target'));
  assert.ok(target);target.fire('click');assert.equal(b.element('moves').textContent,'1');
  b.click('pause-btn');assert.equal(b.element('pause-overlay').hidden,false);assert.equal(b.get(GAME),null);
});

test('카드를 바로 선택하고 다른 카드로 바꾸거나 놓기 버튼으로 이동',()=>{
  const b=browser();b.click('start-btn');const state=b.get(GAME),first=state.solution[0];
  const source=point(b,first.from);assert.equal(source.tagName,'BUTTON');source.fire('click');
  assert.equal(b.element('card-picker').hidden,true);
  assert.equal(b.element('selection-bar').hidden,false);
  assert.equal(point(b,first.from).attributes['aria-pressed'],'true');
  if(first.to.type==='column') {
    const place=b.element('tableau').children[first.to.index].children[0];
    assert.equal(place.textContent,'놓기');assert.equal(place.tagName,'BUTTON');place.fire('click');
  } else point(b,first.to).fire('click');
  assert.equal(b.get(GAME).moves,1);b.click('undo-btn');
  const a={type:'column',index:0,start:state.columns[0].length-1};
  const i=state.columns.findIndex((c,i)=>i!==0&&!G.canMove(state,a,{type:'column',index:i}));assert.ok(i>=0);
  point(b,a).fire('click');const other={type:'column',index:i,start:state.columns[i].length-1};point(b,other).fire('click');
  assert.equal(point(b,other).attributes['aria-pressed'],'true');assert.deepEqual(G.snapshot(b.get(GAME)),G.snapshot(state));
  point(b,other).fire('click');assert.equal(b.element('cancel-btn').disabled,true);
});
