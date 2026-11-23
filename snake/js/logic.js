// 스네이크 규칙. 머리부터 꼬리 순서의 칸 번호와 저장 가능한 난수 상태만 사용한다.
// 매일 도전은 같은 날짜·같은 조작이면 먹이와 결과가 같다. 화면과 시간 흐름은 ui.js.
const Snake = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const COLS = 16;
  const ROWS = 16;
  const INITIAL_LENGTH = 4;
  const FOOD_SCORE = 10;
  const DAILY_TARGET = 10;
  const DAILY_DIFFICULTY = 'medium';
  const DIRECTIONS = {
    up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0],
  };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const DIFFICULTIES = {
    easy: { label: '쉬움', speed: 320, minSpeed: 190, note: '천천히 이동 · 처음이라면 추천해요' },
    medium: { label: '보통', speed: 230, minSpeed: 130, note: '보통 빠르기 · 먹이 5개마다 조금 빨라져요' },
    hard: { label: '어려움', speed: 160, minSpeed: 100, note: '빠르게 이동 · 미리 방향을 정해 보세요' },
  };
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function placeFood(state) {
    const occupied = new Set(state.body);
    const free = [];
    for (let i = 0; i < COLS * ROWS; i++) if (!occupied.has(i)) free.push(i);
    state.food = free.length ? free[Math.floor(Common.nextRandom(state) * free.length)] : null;
  }

  function create(difficulty = 'medium', { daily = null, seedText = null } = {}) {
    if (!has(DIFFICULTIES, difficulty)) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const head = Math.floor(ROWS / 2) * COLS + 5;
    const state = {
      version: 1, difficulty, daily,
      body: Array.from({ length: INITIAL_LENGTH }, (_, i) => head - i),
      direction: 'right', queue: [], food: null,
      eaten: 0, score: 0, moves: 0, elapsed: 0,
      over: false, won: false, reason: null,
      rng: Common.randomState(seedText || (daily ? `maeil-snake:${daily}` : `snake:${Date.now()}:${Math.random()}`)),
    };
    placeFood(state);
    return state;
  }

  // 한 칸 이동하기 전에 최대 두 번의 방향 전환을 예약한다.
  // 빠르게 위→왼쪽을 눌러도, 한 틱에 반대로 돌아 자기 목에 부딪히지 않는다.
  function turn(state, direction) {
    if (state.over || !has(DIRECTIONS, direction) || state.queue.length >= 2) return false;
    const previous = state.queue.length ? state.queue[state.queue.length - 1] : state.direction;
    if (direction === previous || direction === OPPOSITE[previous]) return false;
    state.queue.push(direction);
    return true;
  }

  function step(state) {
    if (state.over) return 'ignored';
    if (state.queue.length) state.direction = state.queue.shift();
    const [dx, dy] = DIRECTIONS[state.direction];
    const x = state.body[0] % COLS + dx;
    const y = Math.floor(state.body[0] / COLS) + dy;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
      state.over = true;
      state.reason = 'wall';
      return 'over';
    }
    const next = y * COLS + x;
    const eating = next === state.food;
    // 먹지 않을 때 꼬리는 동시에 비워진다. 현재 꼬리 칸으로 이동해도 안전하다.
    const occupied = eating ? state.body : state.body.slice(0, -1);
    if (occupied.includes(next)) {
      state.over = true;
      state.reason = 'self';
      return 'over';
    }
    state.body.unshift(next);
    state.moves++;
    if (!eating) {
      state.body.pop();
      return 'moved';
    }
    state.eaten++;
    state.score += FOOD_SCORE;
    placeFood(state);
    if (state.food === null) {
      state.over = true;
      state.won = true;
      state.reason = 'filled';
      return 'won';
    }
    return 'ate';
  }

  function interval(state) {
    const config = DIFFICULTIES[state.difficulty];
    return Math.max(config.minSpeed, config.speed - Math.floor(state.eaten / 5) * 10);
  }

  function isValid(state) {
    if (!state || typeof state !== 'object' || state.version !== 1
      || !has(DIFFICULTIES, state.difficulty) || !has(DIRECTIONS, state.direction)
      || !Array.isArray(state.body) || state.body.length < INITIAL_LENGTH || state.body.length > COLS * ROWS
      || !Array.isArray(state.queue) || state.queue.length > 2
      || !Number.isInteger(state.rng) || state.rng < -2147483648 || state.rng > 2147483647
      || !Number.isInteger(state.eaten) || state.eaten < 0 || state.body.length !== INITIAL_LENGTH + state.eaten
      || state.score !== state.eaten * FOOD_SCORE
      || !Number.isInteger(state.moves) || state.moves < state.eaten
      || !Number.isFinite(state.elapsed) || state.elapsed < 0
      || typeof state.over !== 'boolean' || typeof state.won !== 'boolean'
      || (state.daily !== null && (typeof state.daily !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.daily)))) return false;
    if (!state.body.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < COLS * ROWS)
      || new Set(state.body).size !== state.body.length) return false;
    for (let i = 1; i < state.body.length; i++) {
      const a = state.body[i - 1], b = state.body[i];
      if (Math.abs(a % COLS - b % COLS) + Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) !== 1) return false;
    }
    let previous = state.direction;
    for (const direction of state.queue) {
      if (!has(DIRECTIONS, direction) || direction === previous || direction === OPPOSITE[previous]) return false;
      previous = direction;
    }
    if (state.won) return state.over && state.reason === 'filled' && state.body.length === COLS * ROWS && state.food === null;
    return Number.isInteger(state.food) && state.food >= 0 && state.food < COLS * ROWS && !state.body.includes(state.food)
      && (state.over ? ['wall', 'self'].includes(state.reason) : state.reason === null);
  }

  return { COLS, ROWS, INITIAL_LENGTH, FOOD_SCORE, DAILY_TARGET, DAILY_DIFFICULTY, DIFFICULTIES, create, turn, step, interval, isValid };
})();

if (typeof module !== 'undefined') module.exports = Snake;
