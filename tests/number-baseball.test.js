const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../number-baseball/js/logic.js');
const M = require('../common/core.js');
const copy = (value) => JSON.parse(JSON.stringify(value));
const fresh = (difficulty = 'medium') => G.create(difficulty, { random: M.createSeededRandom('baseball-test') });

test('숫자·자리 일치와 숫자만 일치, 0의 위치·아웃·정답', () => {
  assert.deepEqual(G.evaluate('427', '472'), { strikes: 1, balls: 2 });
  assert.deepEqual(G.evaluate('427', '274'), { strikes: 0, balls: 3 });
  assert.deepEqual(G.evaluate('427', '135'), { strikes: 0, balls: 0 });
  assert.deepEqual(G.evaluate('102', '120'), { strikes: 1, balls: 2 });
  assert.deepEqual(G.evaluate('427', '427'), { strikes: 3, balls: 0 });
});

test('전체 세 자리 648×648 판정을 독립 집합 계산과 대조', () => {
  const options = G.candidates('medium');
  for (const answer of options) {
    const a = new Set(answer);
    for (const guess of options) {
      const strikes = [...guess].reduce((n, d, i) => n + Number(answer[i] === d), 0);
      const common = [...new Set(guess)].filter((d) => a.has(d)).length;
      const result = G.evaluate(answer, guess);
      assert.equal(result.strikes, strikes); assert.equal(result.balls, common - strikes);
      assert.deepEqual(result, G.evaluate(guess, answer));
    }
  }
});

test('각 난이도의 정답 수·사용 숫자·고유성·첫 자리 0 제외', () => {
  const counts = { easy: 120, medium: 648, hard: 4536 };
  for (const [key, count] of Object.entries(counts)) {
    const options = G.candidates(key), config = G.DIFFICULTIES[key];
    assert.equal(options.length, count); assert.equal(new Set(options).size, count);
    assert.ok(Object.isFrozen(options)); assert.ok(options.every((n) => G.validNumber(n, config)));
    for (let seed = 0; seed < 365; seed++) {
      const state = G.create(key, { random: M.createSeededRandom(`${key}:${seed}`) });
      assert.ok(G.isValid(state)); assert.equal(state.draft.length, config.digits);
      assert.ok(options.includes(state.answer));
    }
  }
  assert.throws(() => G.create('unknown')); assert.throws(() => G.create('__proto__'));
});

test('한국 날짜 시드: 같은 날 같은 정답·저장된 판의 정답 유지', () => {
  const make = (day) => G.create('medium', { daily: day, random: M.dailyRandom('number-baseball', day) });
  assert.deepEqual(make('2026-11-24'), make('2026-11-24'));
  const values = new Set();
  for (let i = 1; i <= 28; i++) values.add(make(`2026-11-${String(i).padStart(2, '0')}`).answer);
  assert.ok(values.size > 20);
  const state = make('2026-11-24'); G.putDigit(state, '1');
  const resumed = copy(state); assert.ok(G.isValid(resumed)); assert.equal(resumed.answer, state.answer);
});

test('숫자 입력은 다음 빈자리로, 0·중복·범위 밖은 상태 보존', () => {
  const s = fresh(), before = copy(s);
  assert.equal(G.putDigit(s, '0'), 'leading-zero'); assert.deepEqual(s, before);
  assert.equal(G.putDigit(s, '1'), 'ok'); assert.equal(s.cursor, 1);
  const one = copy(s); assert.equal(G.putDigit(s, '1'), 'duplicate'); assert.deepEqual(s, one);
  assert.equal(G.putDigit(s, '0'), 'ok'); assert.equal(s.cursor, 2);
  assert.equal(G.putDigit(s, '2'), 'ok'); assert.equal(s.draft.join(''), '102');
  assert.equal(G.putDigit(s, '2'), 'ignored'); assert.equal(G.putDigit(s, 'x'), 'range');
  assert.ok(G.isValid(s)); assert.equal(G.putDigit(fresh('easy'), '9'), 'range');
});

test('지우기·비우기·입력 되돌리기와 최근 40단계 보관', () => {
  const s = fresh(); G.paste(s, '123');
  assert.ok(G.erase(s)); assert.deepEqual(s.draft, ['1', '2', '']);
  G.erase(s); assert.deepEqual(s.draft, ['1', '', '']);
  assert.ok(G.undoDraft(s)); assert.deepEqual(s.draft, ['1', '2', '']);
  G.clear(s); assert.deepEqual(s.draft, ['', '', '']);
  G.undoDraft(s); assert.deepEqual(s.draft, ['1', '2', '']);
  s.cursor = 2; G.putDigit(s, '3'); s.cursor = 0; G.erase(s); G.erase(s);
  assert.deepEqual(s.draft, ['', '2', '']);
  for (let i = 0; i < 100; i++) { G.paste(s, i % 2 ? '123' : '456'); }
  assert.equal(s.draftHistory.length, G.MAX_DRAFT_HISTORY); assert.ok(G.isValid(s));
});

test('정상 추측만 시도에 포함하고 중복 제출·불완전 입력을 거절', () => {
  const s = fresh(); assert.equal(G.submit(s).status, 'incomplete'); assert.equal(s.guesses.length, 0);
  const guess = G.candidates('medium').find((n) => n !== s.answer);
  G.paste(s, guess); const result = G.submit(s);
  assert.equal(result.status, 'accepted'); assert.equal(s.guesses.length, 1);
  assert.ok(s.draft.every((n) => n === '')); assert.equal(s.draftHistory.length, 0);
  assert.equal(G.undoDraft(s), false);
  G.paste(s, guess); const repeated = G.submit(s);
  assert.equal(repeated.status, 'repeated'); assert.equal(repeated.attempt, 1); assert.equal(s.guesses.length, 1);
  assert.ok(G.isValid(s));
});

test('끝까지 맞히면 종료하고 이후 입력·힌트·제출은 상태를 바꾸지 않음', () => {
  const s = fresh(); G.paste(s, s.answer); assert.equal(G.submit(s).status, 'won');
  assert.ok(G.isDone(s)); assert.ok(G.isValid(s)); const before = copy(s);
  assert.equal(G.putDigit(s, '1'), 'done'); assert.equal(G.reveal(s), null);
  assert.equal(G.undoDraft(s), false); assert.equal(G.submit(s).status, 'done'); assert.deepEqual(s, before);
});

test('힌트는 자리를 순서대로 공개하며 마지막 한 자리는 남긴다', () => {
  for (const key of Object.keys(G.DIFFICULTIES)) {
    const s = fresh(key), answer = s.answer;
    for (let i = 0; i < answer.length - 1; i++) assert.deepEqual(G.reveal(s), { position: i, digit: answer[i] });
    assert.equal(G.reveal(s), null); assert.equal(s.hintsUsed, answer.length - 1); assert.ok(G.isValid(s));
  }
});

test('추측·자리 힌트로 후보를 걸러도 실제 정답은 항상 남는다', () => {
  for (const key of Object.keys(G.DIFFICULTIES)) {
    const s = fresh(key), random = M.createSeededRandom('candidates:' + key), options = G.candidates(key);
    let previous = options.length;
    for (let i = 0; i < 8 && !G.isDone(s); i++) {
      G.paste(s, options[Math.floor(random() * options.length)]); G.submit(s);
      if (i === 2) G.reveal(s);
      const possible = G.remainingCandidates(s);
      assert.ok(possible.includes(s.answer)); assert.ok(possible.length <= previous); previous = possible.length;
    }
  }
});

test('붙여넣기: 중복·첫 자리 0·길이·숫자 범위 검사', () => {
  const s = fresh(), before = copy(s);
  for (const text of ['012', '111', '12', '1234', '１2３', 'abc', null, 123]) {
    assert.equal(G.paste(s, text), false); assert.deepEqual(s, before);
  }
  assert.equal(G.paste(s, '102'), true); assert.equal(G.paste(fresh('easy'), '789'), false);
});

test('결과 공유에는 정답·입력 숫자 대신 판정과 힌트 횟수만 포함한다', () => {
  const s = fresh(); G.paste(s, '987'); G.submit(s);
  G.reveal(s); G.paste(s, s.answer); G.submit(s);
  const text = G.shareText(s);
  assert.ok(!text.includes(s.answer)); assert.ok(!text.includes('987'));
  assert.match(text, /2번 만에 정답/); assert.match(text, /자리 힌트 1회/); assert.match(text, /3S 0B/);
});

test('손상된 판정·중복 추측·잘못된 입력·완료 상태·난이도는 복원하지 않음', () => {
  const base = fresh(); G.paste(base, G.candidates('medium').find((n) => n !== base.answer)); G.submit(base);
  const cases = [
    (s) => { s.answer = '001'; }, (s) => { s.guesses[0].strikes = 9; },
    (s) => { s.guesses.push(copy(s.guesses[0])); }, (s) => { s.status = 'won'; },
    (s) => { s.draft = ['1', '1', '']; }, (s) => { s.draft = ['0', '', '']; },
    (s) => { s.cursor = 9; }, (s) => { s.hintsUsed = 3; }, (s) => { s.elapsed = -1; },
    (s) => { s.draftHistory = [{}]; }, (s) => { s.started = false; }, (s) => { s.difficulty = '__proto__'; },
  ];
  assert.ok(G.isValid(base));
  for (const mutate of cases) { const s = copy(base); mutate(s); assert.equal(G.isValid(s), false); }
  for (const value of [null, [], {}, 'save', false]) assert.equal(G.isValid(value), false);
});
