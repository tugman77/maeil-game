// 지뢰찾기 규칙. 판은 길이 rows*cols 배열(0/1)로 저장한다.
// - 새 게임: 첫 칸을 누른 뒤 지뢰를 놓아 첫 칸과 주변 8칸은 늘 안전하다.
// - 매일 도전: 날짜로 지뢰를 놓고, 주변에 지뢰가 없는 칸 하나를 미리 열어 둔 채 시작한다.
//   (누구나 같은 판 + 첫 클릭에 지는 일 없음)
const Minesweeper = (() => {
  const DIFFICULTIES = {
    easy: { label: '쉬움', cols: 9, rows: 9, mines: 10 },
    medium: { label: '보통', cols: 9, rows: 12, mines: 20 },
    hard: { label: '어려움', cols: 10, rows: 14, mines: 30 },
  };
  const DAILY_DIFFICULTY = 'medium';

  function neighbors(state, i) {
    const { cols, rows } = state;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
      }
    }
    return out;
  }

  const count = (state, i) => neighbors(state, i).reduce((sum, n) => sum + state.mines[n], 0);

  function blank(difficulty, daily) {
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const size = config.rows * config.cols;
    return {
      difficulty,
      daily,
      rows: config.rows,
      cols: config.cols,
      mineCount: config.mines,
      mines: null, // 첫 칸을 누르기 전(새 게임)에는 아직 없음
      revealed: new Array(size).fill(0),
      flagged: new Array(size).fill(0),
      over: false,
      won: false,
      exploded: -1,
      elapsed: 0,
      started: false,
    };
  }

  // safe 칸들을 빼고 지뢰를 무작위로 놓는다.
  function placeMines(state, random, safe = []) {
    const size = state.rows * state.cols;
    const banned = new Set(safe);
    const spots = [];
    for (let i = 0; i < size; i++) if (!banned.has(i)) spots.push(i);
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    state.mines = new Array(size).fill(0);
    spots.slice(0, state.mineCount).forEach((i) => { state.mines[i] = 1; });
  }

  function create(difficulty, { daily = null, random = null } = {}) {
    const state = blank(difficulty, daily);
    if (!random) return state; // 새 게임: 첫 칸을 누를 때 지뢰를 놓는다
    // 매일 도전: 주변 지뢰 0인 칸이 생길 때까지(거의 항상 첫 번에) 놓고, 그중 하나를 열어 둔다.
    for (;;) {
      placeMines(state, random);
      const zeros = [];
      for (let i = 0; i < state.mines.length; i++) {
        if (!state.mines[i] && count(state, i) === 0) zeros.push(i);
      }
      if (zeros.length) {
        floodReveal(state, zeros[Math.floor(random() * zeros.length)]);
        return state;
      }
    }
  }

  // 0인 칸이면 주변을 이어서 연다.
  function floodReveal(state, start) {
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      if (state.revealed[i] || state.flagged[i] || state.mines[i]) continue;
      state.revealed[i] = 1;
      if (count(state, i) === 0) neighbors(state, i).forEach((n) => { if (!state.revealed[n]) stack.push(n); });
    }
  }

  function checkWin(state) {
    const done = state.revealed.every((open, i) => open || state.mines[i]);
    if (done) {
      state.over = true;
      state.won = true;
      // 남은 지뢰에 깃발을 꽂아 보여 준다.
      state.flagged = state.mines.slice();
    }
    return done;
  }

  // 결과: 'ignored' | 'open' | 'boom' | 'win'
  function reveal(state, i, random = Math.random) {
    if (state.over || state.revealed[i] || state.flagged[i]) return 'ignored';
    if (!state.mines) placeMines(state, random, [i, ...neighbors(state, i)]);
    state.started = true;
    if (state.mines[i]) {
      state.over = true;
      state.exploded = i;
      return 'boom';
    }
    floodReveal(state, i);
    return checkWin(state) ? 'win' : 'open';
  }

  // 열린 숫자 칸을 누르면: 주변 깃발 수가 숫자와 같을 때 나머지 주변 칸을 한 번에 연다.
  function chord(state, i) {
    if (state.over || !state.revealed[i]) return 'ignored';
    const around = neighbors(state, i);
    const flags = around.filter((n) => state.flagged[n]).length;
    const number = count(state, i);
    if (number === 0 || flags !== number) return 'ignored';
    let result = 'ignored';
    for (const n of around) {
      if (state.revealed[n] || state.flagged[n]) continue;
      result = reveal(state, n);
      if (result === 'boom' || result === 'win') return result;
    }
    return result;
  }

  function toggleFlag(state, i) {
    if (state.over || state.revealed[i]) return false;
    state.flagged[i] = state.flagged[i] ? 0 : 1;
    state.started = true;
    return true;
  }

  const flagsLeft = (state) => state.mineCount - state.flagged.reduce((a, b) => a + b, 0);

  function isValid(state) {
    const config = state && DIFFICULTIES[state.difficulty];
    if (!config) return false;
    const size = config.rows * config.cols;
    const ok = (arr) => Array.isArray(arr) && arr.length === size;
    return state.rows === config.rows && state.cols === config.cols
      && (state.mines === null || ok(state.mines)) && ok(state.revealed) && ok(state.flagged)
      && Number.isFinite(state.elapsed);
  }

  return {
    DIFFICULTIES, DAILY_DIFFICULTY, create, reveal, chord, toggleFlag, flagsLeft, count, neighbors, isValid,
  };
})();

if (typeof module !== 'undefined') module.exports = Minesweeper;
