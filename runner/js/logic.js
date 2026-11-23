// 점프 러너 규칙(화면 없음, node로 검사 가능). 세상은 가로 360 × 세로 200 단위, 시간은 초.
// 병아리가 저절로 달리고, 누르면 점프. 장애물(돌·화분·울타리·돌 두 개)을 넘는다. 부딪히면 목숨 하나.
// 장애물 순서·간격은 저장 가능한 난수(state.rng) → 오늘의 도전은 누구나 같은 길.
const Runner = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const W = 360;
  const H = 200;
  const GROUND = 168;        // 땅 높이(y)
  const PX = 56;             // 병아리 x(왼쪽)
  const PW = 30;
  const PH = 30;
  const GRAVITY = 2300;
  const JUMP = 760;          // 점프 높이 약 125, 공중 약 0.66초
  const BUFFER = 0.12;       // 땅에 닿기 직전에 누른 점프도 받아 준다
  const HIT_INSET = 6;       // 부딪힘 판정을 그림보다 조금 작게(억울하지 않게)
  const INVINCIBLE = 1.4;
  const METER = 24;          // 24단위 = 1m
  const DAILY_TARGET = 500;  // m
  const OBSTACLES = {
    rock: { w: 26, h: 22 },
    pot: { w: 24, h: 32 },
    fence: { w: 16, h: 42 },
    rocks: { w: 54, h: 22 },
  };
  const DIFFICULTIES = {
    easy: { label: '쉬움', speed: 220, max: 380, lives: 3, gap: [1.25, 2.2], note: '천천히 달려요 · 목숨 3개' },
    medium: { label: '보통', speed: 260, max: 440, lives: 2, gap: [1.05, 1.9], note: '보통 빠르기 · 목숨 2개' },
    hard: { label: '어려움', speed: 310, max: 520, lives: 1, gap: [0.9, 1.6], note: '빠르게 달려요 · 목숨 1개' },
  };
  const DAILY_DIFFICULTY = 'medium';
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function create(difficulty = 'medium', { daily = null, seedText = null } = {}) {
    if (!has(DIFFICULTIES, difficulty)) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const config = DIFFICULTIES[difficulty];
    const state = {
      version: 1, difficulty, daily,
      x: 0,                    // 달린 거리(단위)
      y: GROUND - PH, vy: 0,   // 병아리 위치(위쪽 y)·세로 속도
      onGround: true, buffer: 0, invincible: 0,
      lives: config.lives, jumps: 0,
      obstacles: [],           // { type, x }  (x: 세상 좌표)
      nextAt: W + 380,         // 다음 장애물을 놓을 세상 좌표(첫 장애물은 출발 후 약 2.5초 뒤)
      over: false, goal: false, elapsed: 0,
      rng: Common.randomState(seedText || (daily ? `maeil-runner:${daily}` : `runner:${Date.now()}:${Math.random()}`)),
    };
    return state;
  }

  const speedOf = (state) => {
    const c = DIFFICULTIES[state.difficulty];
    return Math.min(c.max, c.speed + (state.x / METER / 100) * 14); // 100m마다 조금씩 빨라짐
  };
  const meters = (state) => Math.floor(state.x / METER);

  function jump(state) {
    if (state.over) return false;
    if (state.onGround) {
      state.vy = -JUMP;
      state.onGround = false;
      state.buffer = 0;
      state.jumps++;
      return true;
    }
    state.buffer = BUFFER;
    return false;
  }

  // 다음 장애물 종류와 간격. 거리가 늘수록 울타리·돌 두 개가 자주 나온다.
  function spawn(state) {
    const m = meters(state);
    const r = Common.nextRandom(state);
    let type = 'rock';
    if (m > 60 && r < 0.25) type = 'pot';
    if (m > 150 && r >= 0.25 && r < 0.45) type = 'fence';
    if (m > 250 && r >= 0.45 && r < 0.6) type = 'rocks';
    state.obstacles.push({ type, x: state.nextAt });
    const [a, b] = DIFFICULTIES[state.difficulty].gap;
    const seconds = a + Common.nextRandom(state) * (b - a);
    // 착지 후 다시 뛸 수 있는 최소 간격(공중 0.66초 + 여유)을 지킨다
    const gap = Math.max(seconds, 0.85) * speedOf(state) + OBSTACLES[type].w;
    state.nextAt += gap;
  }

  // dt초 진행. 일어난 일: jump(버퍼로 뛴 경우)·land·hit·goal·over
  function step(state, dt) {
    const events = [];
    if (state.over) return events;
    state.elapsed += dt;
    const before = meters(state);
    state.x += speedOf(state) * dt;
    if (!state.goal && state.daily && meters(state) >= DAILY_TARGET && before < DAILY_TARGET) {
      state.goal = true;
      events.push({ type: 'goal' });
    }
    // 병아리
    if (!state.onGround) {
      state.vy += GRAVITY * dt;
      state.y += state.vy * dt;
      if (state.y >= GROUND - PH) {
        state.y = GROUND - PH;
        state.vy = 0;
        state.onGround = true;
        events.push({ type: 'land' });
        if (state.buffer > 0) { jump(state); events.push({ type: 'jump' }); }
      }
    }
    if (state.buffer > 0) state.buffer = Math.max(0, state.buffer - dt);
    if (state.invincible > 0) state.invincible = Math.max(0, state.invincible - dt);
    // 장애물 만들기·지우기
    while (state.nextAt < state.x + W + 40) spawn(state);
    state.obstacles = state.obstacles.filter((o) => o.x + OBSTACLES[o.type].w > state.x - 40);
    // 부딪힘
    if (state.invincible === 0) {
      const left = state.x + PX + HIT_INSET;
      const right = state.x + PX + PW - HIT_INSET;
      const bottom = state.y + PH - 3;
      for (const o of state.obstacles) {
        const s = OBSTACLES[o.type];
        if (right > o.x + 3 && left < o.x + s.w - 3 && bottom > GROUND - s.h + 3) {
          state.lives--;
          state.invincible = INVINCIBLE;
          events.push({ type: 'hit' });
          if (state.lives <= 0) {
            state.over = true;
            events.push({ type: 'over' });
          }
          break;
        }
      }
    }
    return events;
  }

  function isValid(state) {
    return Boolean(state) && typeof state === 'object' && state.version === 1 && has(DIFFICULTIES, state.difficulty)
      && ['x', 'y', 'vy', 'elapsed', 'nextAt'].every((k) => Number.isFinite(state[k]))
      && Array.isArray(state.obstacles) && state.obstacles.every((o) => has(OBSTACLES, o.type) && Number.isFinite(o.x))
      && Number.isInteger(state.lives) && Number.isInteger(state.rng);
  }

  return { W, H, GROUND, PX, PW, PH, METER, DAILY_TARGET, OBSTACLES, DIFFICULTIES, DAILY_DIFFICULTY, create, jump, step, speedOf, meters, isValid };
})();

if (typeof module !== 'undefined') module.exports = Runner;
