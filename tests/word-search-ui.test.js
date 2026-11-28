const test=require('node:test');
const assert=require('node:assert/strict');
const gameDom=require('./helpers/game-dom');
const G=require('../word-search/js/logic');
const GAME='maeil-game.word-search.game.v1',STATS='maeil-game.word-search.stats.v1';
const browser=options=>gameDom('word-search',options);
function choose(b,p){b.element('board').children[p[0]].fire('click');b.element('board').children[p.at(-1)].fire('click');}

test('기본 시작·선택 취소·실패 선택이 저장된 진행을 바꾸지 않는다',()=>{
  const b=browser();b.click('start-btn');const s=b.get(GAME);assert.equal(s.difficulty,'normal');assert.equal(b.element('board').children.length,36);
  b.element('board').children[0].fire('click');b.click('cancel-btn');assert.deepEqual(b.get(GAME),s);
  choose(b,[0,8]);assert.deepEqual(b.get(GAME),s);
  b.element('board').children[0].fire('keydown',{key:'ArrowRight'});assert.equal(b.document.activeElement,b.element('board').children[1]);
});
test('찾음·되돌리기·힌트·저장 이어하기를 실제 UI 흐름으로 검증',()=>{
  const b=browser();b.click('start-btn');const s=b.get(GAME);choose(b,s.placements[0]);assert.deepEqual(b.get(GAME).found,[0]);
  b.click('hint-btn');assert.equal(b.get(GAME).hints,1);b.click('undo-btn');assert.deepEqual(b.get(GAME).found,[]);assert.equal(b.get(GAME).hints,1);
  b.click('home-btn');assert.equal(b.element('continue-wrap').hidden,false);const c=browser({saved:{[GAME]:b.get(GAME)}});c.click('continue-btn');assert.deepEqual(c.get(GAME),b.get(GAME));
});
test('일시정지·탭 숨김·bfcache 동안 조작을 막고 재개한다',()=>{
  const b=browser();b.click('start-btn');b.click('pause-btn');const s=b.get(GAME);b.click('hint-btn');choose(b,s.placements[0]);assert.deepEqual(b.get(GAME),s);
  b.click('resume-btn');choose(b,s.placements[0]);assert.equal(b.get(GAME).found.length,1);
  b.document.hidden=true;b.document.fire('visibilitychange');assert.equal(b.element('pause-overlay').hidden,false);b.click('resume-btn');b.window.fire('pageshow',{persisted:true});assert.equal(b.element('pause-overlay').hidden,false);
});
test('모든 단어 완료 시 저장 삭제·출석·기록 한 번 반영, 다시 도전은 같은 판',()=>{
  const a=browser({hash:'#daily'}),b=browser({hash:'#daily'}),s=a.get(GAME);assert.deepEqual(s,b.get(GAME));
  for(const p of s.placements)choose(a,p);
  assert.equal(a.element('result-screen').hidden,false);assert.equal(a.get(GAME),null);assert.equal(a.get(STATS).daily.played,1);
  assert.ok(a.get('maeil-game.daily.v1').done['2026-11-23'].includes('word-search'));
  a.window.fire('pagehide');assert.equal(a.get(STATS).daily.played,1);a.click('again-btn');assert.deepEqual(a.get(GAME),s);
});
test('지난 날짜 판의 완료는 해당 날짜에만 출석하고 손상 저장은 무시',()=>{
  const s=G.create('normal',{daily:'2026-11-22'}),b=browser({saved:{[GAME]:s}});b.click('continue-btn');for(const p of s.placements)choose(b,p);
  assert.ok(b.get('maeil-game.daily.v1').done['2026-11-22'].includes('word-search'));assert.equal(b.get('maeil-game.daily.v1').done['2026-11-23'],undefined);
  const bad=browser({saved:{[GAME]:{version:1,grid:[]}}});assert.equal(bad.element('continue-wrap').hidden,true);bad.click('start-btn');assert.ok(G.isValid(bad.get(GAME)));
});
test('저장 차단 환경에서도 시작·힌트·일시정지·완료 가능',()=>{
  const b=browser({blockedStorage:true,saved:{}});b.click('start-btn');b.click('hint-btn');b.click('pause-btn');b.click('resume-btn');assert.equal(b.element('game-screen').hidden,false);
});
