// 2차 게임(오목·벽돌깨기·점프 러너) 규칙 검사. 실행: node --test tests/phase2.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Omok = require('../omok/js/logic.js');
const Bricks = require('../bricks/js/logic.js');
const Runner = require('../runner/js/logic.js');
const copy = (s) => JSON.parse(JSON.stringify(s));

// ---------- 오목 ----------
const at = (x, y) => y * Omok.SIZE + x;

test('오목: 다섯 개를 이으면 승리, 넷은 아직', () => {
  const s = Omok.create('medium', { seedText: 't' });
  for (let x = 2; x < 6; x++) s.board[at(x, 5)] = Omok.BLACK;
  assert.equal(Omok.winLine(s.board, at(5, 5)), null);
  s.board[at(6, 5)] = Omok.BLACK;
  assert.deepEqual(Omok.winLine(s.board, at(6, 5)), [at(2, 5), at(3, 5), at(4, 5), at(5, 5), at(6, 5)]);
  // 대각선
  const d = Omok.create('medium', { seedText: 't' });
  for (let k = 0; k < 5; k++) d.board[at(8 - k, 2 + k)] = Omok.WHITE;
  assert.ok(Omok.winLine(d.board, at(6, 4)));
});

test('오목: 차례·빈칸 검사, 수순과 판이 맞아야 저장본 인정', () => {
  const s = Omok.create('easy', { seedText: 't' });
  assert.ok(Omok.play(s, at(6, 6)));
  assert.equal(Omok.play(s, at(6, 7)), false); // 컴퓨터 차례
  const ai = Omok.aiMove(s);
  assert.ok(ai >= 0 && s.board[ai] === Omok.WHITE);
  assert.equal(Omok.play(s, ai), false); // 이미 돌이 있음
  assert.ok(Omok.isValid(copy(s)));
  const bad = copy(s);
  bad.board[0] = Omok.BLACK;
  assert.equal(Omok.isValid(bad), false);
});

test('오목: 컴퓨터는 이길 수를 두고, 상대 다섯 자리를 막는다(보통·어려움)', () => {
  for (const level of ['medium', 'hard']) {
    // 컴퓨터(백) 넷 → 다섯 완성
    const win = Omok.create(level, { seedText: 'w' });
    win.moves = [at(0, 0), at(3, 3), at(0, 2), at(4, 3), at(0, 4), at(5, 3), at(0, 6), at(6, 3), at(0, 8)];
    win.board.fill(0);
    win.moves.forEach((idx, i) => { win.board[idx] = i % 2 ? Omok.WHITE : Omok.BLACK; });
    const w = Omok.aiMove(win);
    assert.ok(w === at(2, 3) || w === at(7, 3), `${level} 이길 수`);
    assert.equal(win.winner, Omok.WHITE);
    // 흑 넷(한쪽 막힘) → 남은 끝을 막아야 함
    const block = Omok.create(level, { seedText: 'b' });
    block.moves = [at(4, 6), at(3, 6), at(5, 6), at(10, 10), at(6, 6), at(10, 0), at(7, 6)];
    block.board.fill(0);
    block.moves.forEach((idx, i) => { block.board[idx] = i % 2 ? Omok.WHITE : Omok.BLACK; });
    assert.equal(Omok.aiMove(block), at(8, 6), `${level} 막기`);
  }
});

test('오목: 무르기는 두 수를 되돌리고 횟수가 줄어든다', () => {
  const s = Omok.create('easy', { seedText: 'u' });
  Omok.play(s, at(6, 6));
  Omok.aiMove(s);
  const before = s.undoLeft;
  assert.ok(Omok.undo(s));
  assert.equal(s.moves.length, 0);
  assert.equal(s.board.filter(Boolean).length, 0);
  assert.equal(s.undoLeft, before - 1);
  const hard = Omok.create('hard', { seedText: 'u' });
  Omok.play(hard, at(6, 6));
  Omok.aiMove(hard);
  assert.equal(Omok.undo(hard), false);
});

test('오목: 오늘의 도전은 같은 날 같은 첫 모양·같은 응수', () => {
  const a = Omok.create('medium', { daily: '2026-11-23' });
  const b = Omok.create('medium', { daily: '2026-11-23' });
  const c = Omok.create('medium', { daily: '2026-11-24' });
  assert.deepEqual(a.opening, b.opening);
  assert.notDeepEqual(a.opening, c.opening);
  const free = a.board.findIndex((v, i) => !v && i > 60);
  Omok.play(a, free); Omok.play(b, free);
  assert.equal(Omok.aiMove(a), Omok.aiMove(b));
  assert.ok(Omok.isValid(copy(a)));
});

// ---------- 벽돌깨기 ----------
test('벽돌깨기: 오늘의 판은 같은 날 같은 배치, 대칭', () => {
  const a = Bricks.create('medium', { daily: '2026-11-23' });
  const b = Bricks.create('medium', { daily: '2026-11-23' });
  assert.deepEqual(a.bricks, b.bricks);
  assert.ok(Bricks.remaining(a) >= 16);
  for (let r = 0; r < Bricks.MAX_ROWS; r++) {
    for (let c = 0; c < Bricks.COLS; c++) assert.equal(a.bricks[r * Bricks.COLS + c], a.bricks[r * Bricks.COLS + Bricks.COLS - 1 - c]);
  }
});

test('벽돌깨기: 받침대는 판 밖으로 나가지 않고, 공은 눌러야 출발', () => {
  const s = Bricks.create('easy', { seedText: 'p' });
  Bricks.setPaddle(s, -100);
  assert.equal(s.paddle, Bricks.paddleWidth(s) / 2);
  assert.equal(s.ball.x, s.paddle);
  Bricks.step(s, 0.5);
  assert.ok(s.ball.stuck);
  assert.ok(Bricks.launch(s));
  assert.ok(s.ball.vy < 0);
  assert.equal(Bricks.launch(s), false);
});

test('벽돌깨기: 놓치면 공이 줄고, 모두 놓치면 끝', () => {
  const s = Bricks.create('medium', { seedText: 'l' });
  for (let k = 0; k < Bricks.LIVES; k++) {
    Bricks.launch(s);
    Bricks.setPaddle(s, s.ball.x < 160 ? 300 : 20); // 받침대를 반대편으로 치워 둔다
    s.ball.x = s.paddle < 160 ? 300 : 20;
    s.ball.vx = 0;
    s.ball.vy = 400;
    s.ball.y = 420;
    const events = Bricks.step(s, 0.2);
    assert.ok(events.some((e) => e.type === 'lost'));
  }
  assert.equal(s.lives, 0);
  assert.ok(s.over);
});

test('벽돌깨기: 공이 벽돌을 뚫지 않고, 받침대가 따라가면 단계를 깬다', () => {
  for (const d of Object.keys(Bricks.DIFFICULTIES)) {
    const s = Bricks.create(d, { seedText: `auto-${d}` });
    Bricks.launch(s);
    let t = 0;
    while (s.level === 1 && t < 300) {
      Bricks.setPaddle(s, s.ball.x + Math.sin(t * 3) * Bricks.paddleWidth(s) * 0.3);
      Bricks.step(s, 1 / 60);
      if (s.ball.stuck) Bricks.launch(s);
      assert.ok(s.ball.x >= 0 && s.ball.x <= Bricks.W && s.ball.y >= 0);
      t += 1 / 60;
    }
    assert.equal(s.level, 2, `${d} 1단계 통과`);
    assert.equal(s.lives, Bricks.LIVES);
    assert.ok(Bricks.isValid(copy(s)));
  }
});

test('벽돌깨기: 오늘의 판을 모두 깨면 성공으로 끝', () => {
  const s = Bricks.create('medium', { daily: '2026-11-23' });
  s.bricks.fill(0);
  s.bricks[0] = 1;
  s.ball = { x: Bricks.brickX(0) + 10, y: Bricks.brickY(0) + Bricks.BRICK_H + Bricks.R + 1, vx: 0, vy: -200, stuck: false };
  const events = Bricks.step(s, 0.05);
  assert.ok(events.some((e) => e.type === 'clear'));
  assert.ok(s.over && s.won);
});

// ---------- 점프 러너 ----------
function autoRun(state, seconds, k = 0.16) {
  let hits = 0;
  for (let t = 0; t < seconds && !state.over; t += 1 / 60) {
    const sp = Runner.speedOf(state);
    const near = state.obstacles.find((o) => o.x + Runner.OBSTACLES[o.type].w > state.x + Runner.PX);
    if (near) {
      const dist = near.x - (state.x + Runner.PX + Runner.PW);
      if (dist > 0 && dist < sp * k) Runner.jump(state);
    }
    hits += Runner.step(state, 1 / 60).filter((e) => e.type === 'hit').length;
  }
  return hits;
}

test('점프 러너: 제때 뛰면 모든 장애물을 넘을 수 있다(최고 속도까지)', () => {
  for (const d of Object.keys(Runner.DIFFICULTIES)) {
    const s = Runner.create(d, { seedText: `run-${d}` });
    assert.equal(autoRun(s, 200), 0, `${d} 부딪힘 없음`);
    assert.equal(Runner.speedOf(s), Runner.DIFFICULTIES[d].max);
  }
});

test('점프 러너: 가만히 있으면 부딪혀 목숨이 줄고, 깜빡이는 동안은 안전', () => {
  const s = Runner.create('easy', { seedText: 'idle' });
  let firstHit = -1;
  for (let t = 0; t < 30 && !s.over; t += 1 / 60) {
    const ev = Runner.step(s, 1 / 60);
    if (ev.some((e) => e.type === 'hit') && firstHit < 0) {
      firstHit = t;
      assert.equal(s.lives, Runner.DIFFICULTIES.easy.lives - 1);
      assert.ok(s.invincible > 0);
    }
  }
  assert.ok(firstHit > 0);
  assert.ok(s.over);
  assert.equal(s.lives, 0);
});

test('점프 러너: 공중에서는 다시 못 뛰고, 착지 직전 누름은 착지 때 뛴다', () => {
  const s = Runner.create('medium', { seedText: 'j' });
  assert.ok(Runner.jump(s));
  assert.equal(Runner.jump(s), false);
  // 착지 직전까지 진행
  while (!(s.vy > 0 && s.y > Runner.GROUND - Runner.PH - 8)) Runner.step(s, 1 / 120);
  Runner.jump(s);
  let jumped = false;
  for (let k = 0; k < 20; k++) if (Runner.step(s, 1 / 120).some((e) => e.type === 'jump')) jumped = true;
  assert.ok(jumped);
  assert.equal(s.jumps, 2);
});

test('점프 러너: 오늘의 길은 같은 날 같고, 500m에서 목표 알림', () => {
  const a = Runner.create('medium', { daily: '2026-11-23' });
  const b = Runner.create('medium', { daily: '2026-11-23' });
  autoRun(a, 20);
  autoRun(b, 20);
  assert.deepEqual(a.obstacles, b.obstacles);
  const s = Runner.create('medium', { daily: '2026-11-23' });
  s.x = (Runner.DAILY_TARGET * Runner.METER) - 5;
  s.obstacles = [];
  s.nextAt = s.x + 2000;
  const ev = Runner.step(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'goal'));
  assert.ok(s.goal);
  assert.ok(Runner.isValid(copy(s)));
});
