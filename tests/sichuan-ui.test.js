// 실제 core/start/logic/ui를 실행한다. 브라우저 화면 배치·SVG 렌더링은 별도 확인 대상이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../sichuan/js/logic.js');
const M = require('../common/core.js');
const dom = require('./helpers/game-dom.js');
const GAME = 'maeil-game.sichuan.game.v1', STATS = 'maeil-game.sichuan.stats.v1';
const browser = (options) => dom('sichuan', options);
const tile = (b, i) => b.element('board').children[i];
function pair(b, p = G.findPair(b.get(GAME))) { tile(b, p.a).fire('click'); tile(b, p.b).fire('click'); }
function almostDone(daily = null) {
  const state = G.create('medium', { daily, random: M.createSeededRandom('near-end') });
  const sequence = state.solution.slice();
  for (const [a, b] of sequence.slice(0, -1)) G.remove(state, a, b);
  return state;
}

test('시작·3난이도·보통 48개 패·선택과 취소·초기 시간 정지', () => {
  const b = browser(); assert.equal(b.element('game-screen').hidden, true);
  assert.equal(b.element('difficulty-list').children.length, 3);
  b.click('start-btn');
  const state = b.get(GAME);
  assert.equal(state.difficulty, 'medium'); assert.equal(b.element('board').children.length, 48);
  assert.equal(b.element('remaining').textContent, '24');
  b.advance(3000); assert.equal(b.element('timer').textContent, '00:00');
  tile(b, 0).fire('click'); assert.equal(tile(b, 0).attributes['aria-pressed'], 'true');
  tile(b, 0).fire('click'); assert.equal(tile(b, 0).attributes['aria-pressed'], 'false');
  assert.deepEqual(b.get(GAME).board, state.board);
});

test('짝 제거·되돌리기·힌트는 선택만 하며 사용 횟수가 보존된다', () => {
  const b = browser(); b.click('start-btn'); const before = b.get(GAME);
  b.click('hint-btn'); const hinted = b.get(GAME);
  assert.equal(hinted.hintsUsed, 1); assert.deepEqual(hinted.board, before.board);
  assert.equal(b.element('board').children.filter((el) => el.className.includes('hint')).length, 2);
  const p = G.findPair(hinted); tile(b, p.b).fire('click');
  assert.equal(b.get(GAME).moves, 1); assert.equal(b.element('remaining').textContent, '23');
  b.click('undo-btn'); b.advance(500);
  const restored = b.get(GAME);
  assert.deepEqual(restored.board, before.board); assert.equal(restored.undoUsed, 1); assert.equal(restored.hintsUsed, 1);
  assert.ok(G.isValid(restored)); assert.equal(b.element('remaining').textContent, '24');
});

test('다른 그림은 제거하지 않고, 누르고 있는 확인 키는 중복 입력하지 않는다', () => {
  const b = browser(); b.click('start-btn'); const state = b.get(GAME);
  const other = state.board.findIndex((value) => value !== state.board[0]);
  tile(b, 0).fire('click'); tile(b, other).fire('click');
  assert.deepEqual(b.get(GAME).board, state.board); assert.equal(b.get(GAME).mistakes, 1);
  const p = G.findPair(state);
  b.key('Enter', tile(b, p.a));
  b.document.fire('keydown', { key: 'Enter', target: tile(b, p.b), repeat: true });
  assert.equal(b.get(GAME).moves, 0);
  b.key('Enter', tile(b, p.b)); assert.equal(b.get(GAME).moves, 1);
});

test('제거 효과 중 중복 입력 차단·일시정지·재개·타이머', () => {
  const b = browser(); b.click('start-btn'); pair(b);
  const saved = b.get(GAME); const next = G.findPair(saved);
  pair(b, next); assert.equal(b.get(GAME).moves, 1);
  b.click('pause-btn'); assert.equal(b.element('pause-overlay').hidden, false);
  const pausedTime = b.get(GAME).elapsed;
  b.advance(5000); pair(b, next); assert.equal(b.get(GAME).moves, 1);
  b.click('resume-btn'); b.advance(2200); b.click('home-btn');
  assert.ok(b.get(GAME).elapsed >= pausedTime + 2); assert.ok(b.get(GAME).elapsed < pausedTime + 3);
  assert.equal(b.element('continue-wrap').hidden, false);
});

test('효과 도중 처음으로 돌아가도 이전 콜백이 새 게임을 바꾸지 않는다', () => {
  const b = browser(); b.click('start-btn'); pair(b); b.click('home-btn'); b.click('start-btn');
  const fresh = b.get(GAME); b.advance(600);
  assert.equal(fresh.moves, 0); assert.deepEqual(b.get(GAME).board, fresh.board);
  assert.equal(b.element('remaining').textContent, '24');
});

test('저장·새로 열어 이어하기·탭 숨김·뒤로 돌아오기 자동 정지', () => {
  const b = browser(); b.click('start-btn'); pair(b); b.advance(400);
  b.document.hidden = true; b.document.fire('visibilitychange');
  assert.equal(b.element('pause-overlay').hidden, false);
  const saved = b.get(GAME), reopened = browser({ saved: { [GAME]: saved } });
  assert.equal(reopened.element('continue-wrap').hidden, false); reopened.click('continue-btn');
  assert.deepEqual(reopened.get(GAME).board, saved.board);
  reopened.window.fire('pagehide'); assert.equal(reopened.element('pause-overlay').hidden, false);
  reopened.window.fire('pageshow', { persisted: true });
  assert.equal(reopened.element('pause-overlay').hidden, false); reopened.click('resume-btn');
  assert.equal(reopened.element('pause-overlay').hidden, true);
});

test('막힘 안내·재배치·재배치 되돌리기', () => {
  const state = G.create('easy'); state.board.fill(0);
  state.board[14] = 1; state.board[15] = 2; state.board[20] = 2; state.board[21] = 1;
  state.solution = []; state.moves = 16; state.started = true;
  assert.ok(G.isValid(state)); assert.equal(G.findPair(state), null);
  const b = browser({ saved: { [GAME]: state } }); b.click('continue-btn');
  assert.equal(b.element('hint-btn').disabled, true); assert.equal(b.element('shuffle-btn').disabled, false);
  assert.match(b.element('game-status').textContent, /연결할 짝이 없어요/);
  b.click('shuffle-btn'); const shuffled = b.get(GAME);
  assert.equal(shuffled.shufflesUsed, 1); assert.ok(G.findPair(shuffled));
  assert.equal(b.element('shuffle-btn').disabled, true);
  b.click('undo-btn'); assert.deepEqual(b.get(GAME).board, state.board);
  assert.equal(b.get(GAME).shufflesUsed, 1); assert.equal(b.element('shuffle-btn').disabled, false);
});

test('오늘의 도전 링크는 같은 배치로 시작한다', () => {
  const a = browser({ hash: '#daily' }), b = browser({ hash: '#daily' });
  assert.equal(a.element('game-screen').hidden, false);
  assert.equal(a.get(GAME).daily, '2026-11-23'); assert.deepEqual(a.get(GAME), b.get(GAME));
});

test('완료·기록·오늘 출석·다시 도전·중복 집계 방지', () => {
  const state = almostDone('2026-11-23'); state.hintsUsed = 2; state.undoUsed = 1; state.elapsed = 45;
  const b = browser({ saved: { [GAME]: state } }); b.click('continue-btn'); pair(b);
  assert.equal(b.element('result-screen').hidden, false); assert.equal(b.get(GAME), null);
  assert.equal(b.get(STATS).daily.played, 1); assert.equal(b.get(STATS).daily.best, 45);
  assert.ok(b.get('maeil-game.daily.v1').done['2026-11-23'].includes('sichuan'));
  assert.match(b.element('result-detail').textContent, /힌트 2회.*되돌리기 1회/);
  b.window.fire('pagehide'); b.advance(2000); assert.equal(b.get(STATS).daily.played, 1);
  b.click('result-home-btn'); assert.match(b.element('daily-info').textContent, /완료/);
  b.click('daily-btn'); assert.equal(b.get(GAME).moves, 0);
});

test('지난날 이어하기를 마쳐도 더 최근 날짜의 도전 결과를 덮어쓰지 않는다', () => {
  const daily = { date: '2026-11-23', seconds: 30 };
  const b = browser({ saved: { [GAME]: almostDone('2026-11-22'), 'maeil-game.sichuan.daily.v1': daily } });
  b.click('continue-btn'); pair(b);
  assert.deepEqual(b.get('maeil-game.sichuan.daily.v1'), daily);
});

test('손상된 저장 무시·차단된 저장소에서도 시작과 완주 가능', () => {
  const bad = browser({ saved: { [GAME]: { board: [] }, [STATS]: '손상' } });
  assert.equal(bad.element('continue-wrap').hidden, true); bad.click('start-btn'); assert.ok(G.isValid(bad.get(GAME)));
  const b = browser({ blockedStorage: true }); b.click('start-btn');
  for (let i = 0; i < 24; i++) {
    b.click('hint-btn');
    const highlighted = b.element('board').children.filter((el) => el.className.includes('hint'));
    assert.equal(highlighted.length, 2);
    highlighted.find((el) => el.attributes['aria-pressed'] !== 'true').fire('click'); b.advance(400);
  }
  assert.equal(b.element('result-screen').hidden, false); assert.equal(b.get(GAME), null);
});
