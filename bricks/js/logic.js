// 벽돌깨기 규칙(화면 없음, node로 검사 가능). 판은 가로 320 × 세로 440 단위, 시간은 초.
// 공은 작은 걸음(최대 4단위)으로 나눠 움직여 벽돌을 뚫고 지나가지 않는다.
// 벽돌 배치는 저장 가능한 난수(state.rng)로 만든다 → 오늘의 도전은 누구나 같은 판.
const Bricks = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const W = 320;
  const H = 440;
  const COLS = 8;
  const MAX_ROWS = 8;
  const BRICK_W = 34;
  const BRICK_H = 15;
  const GAP = 4;
  const LEFT = (W - (COLS * BRICK_W + (COLS - 1) * GAP)) / 2;
  const TOP = 46;
  const PADDLE_Y = 404;
  const PADDLE_H = 12;
  const R = 6;
  const LIVES = 3;
  const DIFFICULTIES = {
    easy: { label: '쉬움', paddle: 86, speed: 230, note: '받침대가 넓고 공이 느려요' },
    medium: { label: '보통', paddle: 68, speed: 280, note: '보통 받침대 · 보통 빠르기' },
    hard: { label: '어려움', paddle: 54, speed: 330, note: '받침대가 좁고 공이 빨라요' },
  };
  const DAILY_DIFFICULTY = 'medium';
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  const brickX = (col) => LEFT + col * (BRICK_W + GAP);
  const brickY = (row) => TOP + row * (BRICK_H + GAP);

  // 좌우 대칭 무늬로 벽돌을 깐다. 단계가 오를수록 줄이 늘고 두 번 맞아야 깨지는 벽돌이 많아진다.
  function layout(state) {
    const rows = Math.min(MAX_ROWS, 4 + state.level);
    const tough = Math.min(0.45, 0.08 + state.level * 0.07);
    const bricks = new Array(MAX_ROWS * COLS).fill(0);
    let count = 0;
    while (count < 16) {
      bricks.fill(0);
      count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLS / 2; c++) {
          if (Common.nextRandom(state) < 0.18 && r > 0) continue; // 빈자리(무늬)
          const hp = Common.nextRandom(state) < tough ? 2 : 1;
          bricks[r * COLS + c] = hp;
          bricks[r * COLS + (COLS - 1 - c)] = hp;
          count += 2;
        }
      }
    }
    state.bricks = bricks;
  }

  function speedOf(state) {
    return Math.min(DIFFICULTIES[state.difficulty].speed * 1.6, DIFFICULTIES[state.difficulty].speed * (1 + (state.level - 1) * 0.07));
  }

  // 공을 받침대 위에 올려놓는다(눌러야 출발)
  function attach(state) {
    state.ball = { x: state.paddle, y: PADDLE_Y - R - 1, vx: 0, vy: 0, stuck: true };
  }

  function create(difficulty = 'medium', { daily = null, seedText = null } = {}) {
    if (!has(DIFFICULTIES, difficulty)) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const state = {
      version: 1, difficulty, daily,
      level: 1, score: 0, lives: LIVES, broken: 0,
      paddle: W / 2, bricks: [], ball: null,
      over: false, won: false, elapsed: 0,
      rng: Common.randomState(seedText || (daily ? `maeil-bricks:${daily}` : `bricks:${Date.now()}:${Math.random()}`)),
    };
    layout(state);
    attach(state);
    return state;
  }

  const paddleWidth = (state) => DIFFICULTIES[state.difficulty].paddle;

  // 받침대 가운데를 x로 옮긴다(판 밖으로 나가지 않게). 공이 붙어 있으면 같이 움직인다.
  function setPaddle(state, x) {
    const half = paddleWidth(state) / 2;
    state.paddle = Math.max(half, Math.min(W - half, x));
    if (state.ball.stuck) state.ball.x = state.paddle;
  }

  function launch(state) {
    if (state.over || !state.ball.stuck) return false;
    const speed = speedOf(state);
    // 위로 조금 비스듬히(왼쪽·오른쪽은 난수)
    const angle = (Common.nextRandom(state) < 0.5 ? -1 : 1) * (0.35 + Common.nextRandom(state) * 0.25);
    state.ball.vx = speed * Math.sin(angle);
    state.ball.vy = -speed * Math.cos(angle);
    state.ball.stuck = false;
    return true;
  }

  const remaining = (state) => state.bricks.filter((v) => v > 0).length;

  // 공 속도의 세로 성분이 너무 작아지면(좌우로만 오가는 공) 바로잡는다
  function keepAngle(ball, speed) {
    const minVy = speed * 0.3;
    if (Math.abs(ball.vy) < minVy) {
      ball.vy = Math.sign(ball.vy || -1) * minVy;
      ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, speed * speed - minVy * minVy));
    }
  }

  // 원(공)과 겹치는 벽돌 하나 찾기
  function hitBrick(state, x, y) {
    const row0 = Math.max(0, Math.floor((y - R - TOP) / (BRICK_H + GAP)));
    const row1 = Math.min(MAX_ROWS - 1, Math.floor((y + R - TOP) / (BRICK_H + GAP)));
    for (let r = row0; r <= row1; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!state.bricks[i]) continue;
        const bx = brickX(c);
        const by = brickY(r);
        const nx = Math.max(bx, Math.min(x, bx + BRICK_W));
        const ny = Math.max(by, Math.min(y, by + BRICK_H));
        if ((x - nx) ** 2 + (y - ny) ** 2 <= R * R) return i;
      }
    }
    return -1;
  }

  // dt초 진행. 일어난 일 목록을 돌려준다: wall·paddle·brick(row)·break(row)·lost·clear·over
  function step(state, dt) {
    const events = [];
    if (state.over) return events;
    state.elapsed += dt;
    const ball = state.ball;
    if (ball.stuck) { ball.x = state.paddle; return events; }
    const speed = speedOf(state);
    const dist = Math.hypot(ball.vx, ball.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 4));
    for (let k = 0; k < n; k++) {
      const px = ball.x;
      const py = ball.y;
      ball.x += (ball.vx * dt) / n;
      ball.y += (ball.vy * dt) / n;
      // 벽
      if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); events.push({ type: 'wall' }); }
      if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); events.push({ type: 'wall' }); }
      if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); events.push({ type: 'wall' }); }
      // 받침대: 맞은 위치에 따라 튕기는 각도가 달라진다(가운데 = 위로, 끝 = 비스듬히 최대 60°)
      const half = paddleWidth(state) / 2;
      if (ball.vy > 0 && ball.y + R >= PADDLE_Y && py + R <= PADDLE_Y + 2 && Math.abs(ball.x - state.paddle) <= half + R) {
        const hit = Math.max(-1, Math.min(1, (ball.x - state.paddle) / (half + R)));
        const angle = hit * (Math.PI / 3);
        ball.vx = speed * Math.sin(angle);
        ball.vy = -speed * Math.cos(angle);
        ball.y = PADDLE_Y - R;
        events.push({ type: 'paddle' });
      }
      // 벽돌
      const i = hitBrick(state, ball.x, ball.y);
      if (i >= 0) {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        const bx = brickX(c);
        const by = brickY(r);
        // 이전 위치가 벽돌의 가로 범위 밖이었으면 옆면, 아니면 윗면·아랫면에 맞은 것
        const fromSide = px < bx || px > bx + BRICK_W;
        const fromTopBottom = py < by || py > by + BRICK_H;
        if (fromSide && !fromTopBottom) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;
        ball.x = px;
        ball.y = py;
        state.bricks[i]--;
        state.score += 10;
        if (state.bricks[i] === 0) {
          state.broken++;
          events.push({ type: 'break', row: r, col: c });
        } else {
          events.push({ type: 'brick', row: r, col: c });
        }
        if (remaining(state) === 0) {
          state.score += 100 * state.level;
          if (state.daily) {
            state.over = true;
            state.won = true;
            events.push({ type: 'clear' }, { type: 'over' });
          } else {
            state.level++;
            layout(state);
            attach(state);
            events.push({ type: 'clear' });
          }
          return events;
        }
        keepAngle(ball, speed);
      }
      // 바닥으로 놓침
      if (ball.y - R > H) {
        state.lives--;
        events.push({ type: 'lost' });
        if (state.lives <= 0) {
          state.over = true;
          events.push({ type: 'over' });
        } else {
          attach(state);
        }
        return events;
      }
    }
    return events;
  }

  function isValid(state) {
    return Boolean(state) && typeof state === 'object' && state.version === 1
      && has(DIFFICULTIES, state.difficulty)
      && Array.isArray(state.bricks) && state.bricks.length === MAX_ROWS * COLS && state.bricks.every((v) => v === 0 || v === 1 || v === 2)
      && state.ball && ['x', 'y', 'vx', 'vy'].every((k) => Number.isFinite(state.ball[k]))
      && Number.isInteger(state.level) && state.level >= 1
      && Number.isInteger(state.lives) && state.lives >= 0 && state.lives <= LIVES
      && Number.isInteger(state.score) && Number.isInteger(state.rng) && Number.isFinite(state.elapsed)
      && (state.daily === null || /^\d{4}-\d{2}-\d{2}$/.test(state.daily));
  }

  return {
    W, H, COLS, MAX_ROWS, BRICK_W, BRICK_H, LEFT, TOP, GAP, PADDLE_Y, PADDLE_H, R, LIVES, DIFFICULTIES, DAILY_DIFFICULTY,
    brickX, brickY, create, setPaddle, launch, step, remaining, paddleWidth, speedOf, isValid,
  };
})();

if (typeof module !== 'undefined') module.exports = Bricks;
