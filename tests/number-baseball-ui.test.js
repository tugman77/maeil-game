// 실제 core/start/logic/ui 실행 검사. CSS·실제 모바일 렌더링은 별도 검수 대상이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../number-baseball/js/logic.js');
const M = require('../common/core.js');
const dom = require('./helpers/game-dom.js');
const GAME = 'maeil-game.number-baseball.game.v1', STATS = 'maeil-game.number-baseball.stats.v1', DAILY = 'maeil-game.number-baseball.daily.v1';
const browser = (options) => dom('number-baseball', options);
const digit = (b, n) => b.element('keypad').children.find((el) => el.dataset.digit === n);
const paste = (b, text) => b.document.fire('paste', { clipboardData: { getData: () => text } });
function prepared({ hints = 0, wrong = 0, daily = null } = {}) {
  const state = G.create('medium', { daily, random: daily ? M.dailyRandom('number-baseball', daily) : M.createSeededRandom('ui-baseball') });
  const guesses = G.candidates('medium').filter((n) => n !== state.answer);
  for (let i = 0; i < wrong; i++) { G.paste(state, guesses[i]); G.submit(state); }
  for (let i = 0; i < hints; i++) G.reveal(state);
  return state;
}
function win(state, extraSaved = {}) {
  const b = browser({ saved: { [GAME]: state, ...extraSaved } }); b.click('continue-btn');
  paste(b, state.answer); b.click('submit-btn'); return b;
}

test('보통 기본값·세 자리·키패드 12칸·초기 타이머 정지', () => {
  const b = browser(); assert.equal(b.element('game-screen').hidden, true);
  b.click('start-btn'); const state = b.get(GAME);
  assert.equal(state.difficulty, 'medium'); assert.equal(b.element('guess-slots').children.length, 3);
  assert.equal(b.element('keypad').children.length, 12); assert.equal(digit(b, '0').disabled, true);
  assert.equal(b.element('submit-btn').disabled, true); assert.equal(b.element('candidate-info').hidden, true);
  b.advance(4000); assert.equal(b.element('timer').textContent, '00:00');
});

test('숫자 선택·중복 차단·지우기·입력 되돌리기·비우기', () => {
  const b = browser(); b.click('start-btn');
  digit(b, '1').fire('click'); assert.equal(digit(b, '1').disabled, true); assert.equal(digit(b, '0').disabled, false);
  digit(b, '0').fire('click'); digit(b, '2').fire('click');
  assert.deepEqual(b.get(GAME).draft, ['1', '0', '2']); assert.equal(b.element('submit-btn').disabled, false);
  b.click('erase-btn'); assert.deepEqual(b.get(GAME).draft, ['1', '0', '']);
  b.click('undo-btn'); assert.deepEqual(b.get(GAME).draft, ['1', '0', '2']);
  b.click('clear-btn'); assert.deepEqual(b.get(GAME).draft, ['', '', '']);
  b.click('undo-btn'); assert.deepEqual(b.get(GAME).draft, ['1', '0', '2']);
  b.element('guess-slots').children[0].fire('click'); digit(b, '3').fire('click');
  assert.deepEqual(b.get(GAME).draft, ['3', '0', '2']); assert.ok(G.isValid(b.get(GAME)));
});

test('판정·추측 기록·중복 제출 거절·입력 되돌리기로 제출 기록은 삭제하지 않음', () => {
  const b = browser(); b.click('start-btn');
  const state = b.get(GAME), guess = G.candidates('medium').find((n) => n !== state.answer);
  paste(b, guess); b.click('submit-btn');
  assert.equal(b.get(GAME).guesses.length, 1); assert.equal(b.element('attempt-list').children.length, 1);
  assert.equal(b.element('attempt-list').children[0].children[1].textContent, guess);
  assert.equal(b.element('undo-btn').disabled, true);
  paste(b, guess); b.click('submit-btn'); assert.equal(b.get(GAME).guesses.length, 1);
  assert.match(b.element('game-status').textContent, /이미 확인한/);
  b.click('undo-btn'); assert.equal(b.get(GAME).guesses.length, 1);
});

test('키보드·붙여넣기·길게 누름·단축키 입력 보호', () => {
  const b = browser(); b.click('start-btn');
  const slot = b.element('guess-slots').children[0];
  b.key('0', slot); assert.match(b.element('game-status').textContent, /첫 자리/);
  b.key('1', slot); b.document.fire('keydown', { key: '2', target: slot, repeat: true });
  assert.deepEqual(b.get(GAME).draft, ['1', '', '']);
  b.document.fire('keydown', { key: '2', target: slot, metaKey: true });
  assert.deepEqual(b.get(GAME).draft, ['1', '', '']);
  b.key('2', slot); b.key('3', slot); b.key('ArrowLeft', slot); assert.equal(b.get(GAME).cursor, 1);
  b.key('Backspace', slot); assert.deepEqual(b.get(GAME).draft, ['1', '', '3']);
  paste(b, '012'); assert.deepEqual(b.get(GAME).draft, ['1', '', '3']);
  const guess = G.candidates('medium').find((n) => n !== b.get(GAME).answer);
  paste(b, '  ' + guess + '  '); b.key('Enter', slot); assert.equal(b.get(GAME).guesses.length, 1);
});

test('쉬움은 숫자 1~6과 후보 수, 어려움은 네 자리', () => {
  for (const [index, key] of [[0, 'easy'], [2, 'hard']]) {
    const b = browser(); b.element('difficulty-list').children[index].fire('click'); b.click('start-btn');
    assert.equal(b.get(GAME).difficulty, key);
    assert.equal(b.element('guess-slots').children.length, G.DIFFICULTIES[key].digits);
    if (key === 'easy') {
      assert.match(b.element('candidate-info').textContent, /120개/); assert.equal(digit(b, '9').disabled, true);
      b.click('hint-btn'); const remaining = G.remainingCandidates(b.get(GAME)).length;
      assert.match(b.element('candidate-info').textContent, new RegExp(`${remaining}개`)); assert.ok(remaining < 120);
    }
  }
});

test('자리 힌트는 순서대로 공개하며 자동으로 입력·제출하지 않음', () => {
  const b = browser(); b.click('start-btn'); const state = b.get(GAME);
  b.click('hint-btn'); b.click('hint-btn'); b.click('hint-btn');
  assert.equal(b.get(GAME).hintsUsed, 2); assert.equal(b.element('hint-btn').disabled, true);
  assert.match(b.element('hint-info').textContent, /힌트 2회/);
  assert.equal(b.get(GAME).guesses.length, 0); assert.deepEqual(b.get(GAME).draft, state.draft);
});

test('일시정지·앱 전환·뒤로 돌아오기·기록용 시간 재개', () => {
  const b = browser(); b.click('start-btn'); digit(b, '1').fire('click'); b.advance(2200);
  b.click('pause-btn'); const elapsed = b.get(GAME).elapsed;
  assert.equal(b.element('play-area').inert, true);
  b.advance(5000); b.key('2'); b.click('hint-btn'); assert.deepEqual(b.get(GAME).draft, ['1', '', '']);
  b.click('resume-btn'); b.advance(1200); b.document.hidden = true; b.document.fire('visibilitychange');
  assert.ok(b.get(GAME).elapsed >= elapsed + 1 && b.get(GAME).elapsed < elapsed + 2);
  assert.equal(b.element('pause-overlay').hidden, false);
  b.window.fire('pageshow', { persisted: true }); assert.equal(b.element('pause-overlay').hidden, false);
});

test('입력·추측·힌트·정답을 저장했다 이어서 플레이', () => {
  const b = browser(); b.click('start-btn'); b.click('hint-btn'); paste(b, '123'); b.click('home-btn');
  const saved = b.get(GAME); assert.equal(b.element('continue-wrap').hidden, false);
  const reopened = browser({ saved: { [GAME]: saved } }); reopened.click('continue-btn');
  assert.deepEqual(reopened.get(GAME), saved); assert.equal(reopened.element('guess-slots').children[0].textContent, '1');
  assert.match(reopened.element('hint-info').textContent, /힌트 1회/);
});

test('오늘의 도전 링크: 같은 세 자리 정답과 초기 상태', () => {
  const a = browser({ hash: '#daily' }), b = browser({ hash: '#daily' });
  assert.equal(a.element('game-screen').hidden, false); assert.equal(a.get(GAME).daily, '2026-11-23');
  assert.deepEqual(a.get(GAME), b.get(GAME)); assert.equal(a.get(GAME).difficulty, 'medium');
});

test('완료·결과·오늘 출석·새 게임·종료 이벤트 중복 집계 방지', () => {
  const state = prepared({ daily: '2026-11-23', wrong: 2, hints: 1 }); state.elapsed = 36;
  const b = win(state);
  assert.equal(b.element('result-screen').hidden, false); assert.equal(b.get(GAME), null);
  assert.equal(b.element('result-answer').textContent, state.answer); assert.equal(b.element('result-attempts').textContent, '3회');
  assert.equal(b.get(STATS).daily.played, 1); assert.equal(b.get(DAILY).hints, 1);
  assert.ok(b.get('maeil-game.daily.v1').done['2026-11-23'].includes('number-baseball'));
  b.window.fire('pagehide'); b.advance(2000); assert.equal(b.get(STATS).daily.played, 1);
  b.click('result-home-btn'); assert.match(b.element('daily-info').textContent, /완료/);
  b.click('daily-btn'); assert.equal(b.get(GAME).answer, state.answer); assert.equal(b.get(GAME).guesses.length, 0);
});

test('최고 기록은 힌트 수→시도 수→시간 순으로 비교', () => {
  const best = { attempts: 2, hints: 0, seconds: 100 }, stats = { medium: { played: 2, best } };
  const assisted = win(prepared({ hints: 1 }), { [STATS]: stats });
  assert.deepEqual(assisted.get(STATS).medium.best, best); assert.equal(assisted.get(STATS).medium.played, 3);
  const normal = win(prepared(), { [STATS]: stats }); assert.equal(normal.get(STATS).medium.best.attempts, 1);
  const slowerState = prepared({ wrong: 1 }); slowerState.elapsed = 120;
  const slower = win(slowerState, { [STATS]: stats }); assert.deepEqual(slower.get(STATS).medium.best, best);
  const quicker = win(prepared({ wrong: 1 }), { [STATS]: stats }); assert.equal(quicker.get(STATS).medium.best.seconds, 0);
});

test('지난 날짜 완료가 최신 도전 기록을 덮어쓰지 않음', () => {
  const latest = { date: '2026-11-23', attempts: 8, hints: 2, seconds: 150 };
  const b = win(prepared({ daily: '2026-11-22' }), { [DAILY]: latest });
  assert.deepEqual(b.get(DAILY), latest);
});

test('손상된 저장 무시·차단된 저장소에서도 실제 정답 추리로 완주', () => {
  const bad = browser({ saved: { [GAME]: { answer: '111' }, [STATS]: '손상' } });
  assert.equal(bad.element('continue-wrap').hidden, true); bad.click('start-btn'); assert.ok(G.isValid(bad.get(GAME)));
  const b = browser({ blockedStorage: true }); b.element('difficulty-list').children[0].fire('click'); b.click('start-btn');
  let options = G.candidates('easy').slice(), attempts = 0;
  while (b.element('result-screen').hidden && attempts < 120) {
    const guess = options[0]; paste(b, guess); b.click('submit-btn'); attempts++;
    if (!b.element('result-screen').hidden) break;
    const row = b.element('attempt-list').children[0], score = row.children[2];
    const values = score.textContent === '아웃' ? { strikes: 0, balls: 0 }
      : { strikes: Number(score.children[0].textContent[0]), balls: Number(score.children[1].textContent[0]) };
    options = options.filter((candidate) => {
      const s = G.evaluate(candidate, guess); return s.strikes === values.strikes && s.balls === values.balls;
    });
  }
  assert.equal(b.element('result-screen').hidden, false); assert.equal(b.get(GAME), null); assert.ok(attempts < 120);
});
