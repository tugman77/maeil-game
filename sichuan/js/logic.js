// 사천성: 같은 패를 빈 공간으로 연결한다. 직선 세 구간(꺾임 두 번)까지, 판 바깥도 허용.
const SichuanGame = (() => {
  const M = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const SYMBOLS = [
    ['🍎', '사과'], ['🍌', '바나나'], ['🍇', '포도'], ['🍉', '수박'],
    ['🥕', '당근'], ['🌽', '옥수수'], ['🌻', '해바라기'], ['🍀', '네잎클로버'],
    ['⭐', '별'], ['🌙', '달'], ['🐟', '물고기'], ['🦋', '나비'],
    ['🍄', '버섯'], ['🚗', '자동차'], ['⚽', '축구공'],
  ];
  const DIFFICULTIES = {
    easy: { label: '쉬움', rows: 6, cols: 6, types: 6 },
    medium: { label: '보통', rows: 8, cols: 6, types: 10 },
    hard: { label: '어려움', rows: 10, cols: 6, types: 15 },
  };
  const DAILY_DIFFICULTY = 'medium';
  const HISTORY_LIMIT = 100;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const remaining = (s) => s.board.filter(Boolean).length / 2;
  const isDone = (s) => remaining(s) === 0;

  // 좌표는 바깥 통로를 포함한 (rows+2)×(cols+2) 판의 [행, 열].
  // 중간 패를 통과하거나 대각선으로 연결할 수 없다.
  function findPath(board, rows, cols, a, b, requireSame = true) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b
      || a < 0 || b < 0 || a >= board.length || b >= board.length
      || !board[a] || !board[b] || (requireSame && board[a] !== board[b])) return null;
    const start = [Math.floor(a / cols) + 1, a % cols + 1];
    const end = [Math.floor(b / cols) + 1, b % cols + 1];
    const free = ([r, c]) => {
      if (r < 0 || c < 0 || r > rows + 1 || c > cols + 1) return false;
      if (r === 0 || c === 0 || r === rows + 1 || c === cols + 1) return true;
      const i = (r - 1) * cols + c - 1;
      return i === a || i === b || board[i] === 0;
    };
    function clear(p, q) {
      if (p[0] !== q[0] && p[1] !== q[1]) return false;
      const dr = Math.sign(q[0] - p[0]), dc = Math.sign(q[1] - p[1]);
      let r = p[0], c = p[1];
      while (true) {
        if (!free([r, c])) return false;
        if (r === q[0] && c === q[1]) return true;
        r += dr; c += dc;
      }
    }
    function route(points) {
      if (!points.slice(1).every((p, i) => clear(points[i], p))) return null;
      const result = [];
      for (const p of points) {
        if (result.length && result.at(-1)[0] === p[0] && result.at(-1)[1] === p[1]) continue;
        while (result.length >= 2) {
          const x = result.at(-2), y = result.at(-1);
          if ((x[0] === y[0] && y[0] === p[0]) || (x[1] === y[1] && y[1] === p[1])) result.pop();
          else break;
        }
        result.push(p);
      }
      return result;
    }
    let result = route([start, end]);
    if (result) return result;
    for (const corner of [[start[0], end[1]], [end[0], start[1]]]) {
      result = route([start, corner, end]);
      if (result) return result;
    }
    for (let r = 0; r <= rows + 1; r++) {
      result = route([start, [r, start[1]], [r, end[1]], end]);
      if (result) return result;
    }
    for (let c = 0; c <= cols + 1; c++) {
      result = route([start, [start[0], c], [end[0], c], end]);
      if (result) return result;
    }
    return null;
  }

  // 패 위치를 먼저 합법적인 쌍으로 비우고 그림을 배정하므로 전체 풀이가 함께 만들어진다.
  function deal(positions, rows, cols, pairValues, random) {
    const occupied = Array(rows * cols).fill(0);
    positions.forEach((i) => { occupied[i] = 1; });
    const board = occupied.slice(), solution = [];
    const values = M.shuffle(pairValues.slice(), random);
    while (positions.length) {
      const shuffled = M.shuffle(positions.slice(), random);
      let pair = null;
      // 대부분은 앞부분에서 발견한다. 못 찾으면 모든 쌍을 훑는다.
      for (let i = 0; i < shuffled.length && !pair; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          if (findPath(occupied, rows, cols, shuffled[i], shuffled[j], false)) {
            pair = [shuffled[i], shuffled[j]];
            break;
          }
        }
      }
      if (!pair) throw new Error('사천성 배치를 만들 수 없습니다.');
      const value = values[solution.length];
      pair.forEach((i) => { occupied[i] = 0; board[i] = value; });
      solution.push(pair);
      positions = positions.filter((i) => !pair.includes(i));
    }
    if (!verifySolution(board, rows, cols, solution)) throw new Error('풀이 경로 검사 실패');
    return { board, solution };
  }

  function verifySolution(board, rows, cols, solution) {
    const rest = board.slice();
    for (const [a, b] of solution) {
      if (!findPath(rest, rows, cols, a, b)) return false;
      rest[a] = 0; rest[b] = 0;
    }
    return rest.every((value) => value === 0);
  }

  function create(difficulty, { daily = null, random = Math.random } = {}) {
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error('알 수 없는 난이도');
    const { rows, cols, types } = config;
    const pool = M.shuffle(SYMBOLS.map((_, i) => i + 1), random).slice(0, types);
    const pairs = Array.from({ length: rows * cols / 2 }, (_, i) => pool[i % pool.length]);
    const dealt = deal(Array.from({ length: rows * cols }, (_, i) => i), rows, cols, pairs, random);
    return {
      version: 1, difficulty, daily, rows, cols, ...dealt,
      shuffleSeed: Math.floor(random() * 0x100000000),
      history: [], moves: 0, mistakes: 0, hintsUsed: 0, undoUsed: 0,
      shufflesUsed: 0, elapsed: 0, started: false,
    };
  }

  function findPair(state) {
    // 기존 풀이에 남아 있는 쌍이 지금 연결되면 먼저 안내한다.
    for (const [a, b] of state.solution) {
      const path = findPath(state.board, state.rows, state.cols, a, b);
      if (path) return { a, b, path };
    }
    for (let a = 0; a < state.board.length; a++) {
      if (!state.board[a]) continue;
      for (let b = a + 1; b < state.board.length; b++) {
        const path = findPath(state.board, state.rows, state.cols, a, b);
        if (path) return { a, b, path };
      }
    }
    return null;
  }

  function remember(state) {
    state.history.push({ board: state.board.slice(), solution: copy(state.solution), moves: state.moves });
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
  }

  function remove(state, a, b) {
    const path = findPath(state.board, state.rows, state.cols, a, b);
    if (!path) return null;
    remember(state);
    state.board[a] = 0; state.board[b] = 0;
    state.solution = state.solution.filter((pair) => !pair.includes(a) && !pair.includes(b));
    state.moves++; state.started = true;
    return path;
  }

  function undo(state) {
    const previous = state.history.pop();
    if (!previous) return false;
    state.board = previous.board; state.solution = previous.solution; state.moves = previous.moves;
    state.undoUsed++;
    return true;
  }

  function reshuffle(state) {
    // 막혔을 때만. 그림 개수·빈자리·진행한 쌍 수는 그대로 유지한다.
    if (isDone(state) || findPair(state)) return false;
    const counts = Array(SYMBOLS.length + 1).fill(0), positions = [], values = [];
    state.board.forEach((value, i) => { if (value) { counts[value]++; positions.push(i); } });
    counts.forEach((count, value) => { for (let i = 0; i < count / 2; i++) values.push(value); });
    const random = M.createSeededRandom(`sichuan:shuffle:${state.shuffleSeed}:${state.shufflesUsed + 1}`);
    const dealt = deal(positions, state.rows, state.cols, values, random);
    remember(state);
    state.board = dealt.board; state.solution = dealt.solution;
    state.shufflesUsed++; state.started = true;
    return true;
  }

  function isValid(state) {
    if (!state || typeof state !== 'object' || state.version !== 1) return false;
    const config = DIFFICULTIES[state.difficulty];
    if (!config || state.rows !== config.rows || state.cols !== config.cols) return false;
    if (state.daily !== null && (typeof state.daily !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.daily))) return false;
    if (state.daily && state.difficulty !== DAILY_DIFFICULTY) return false;
    const size = state.rows * state.cols;
    const boardOK = (board) => {
      if (!Array.isArray(board) || board.length !== size) return false;
      const counts = Array(SYMBOLS.length + 1).fill(0);
      for (const value of board) {
        if (!Number.isInteger(value) || value < 0 || value > SYMBOLS.length) return false;
        counts[value]++;
      }
      return counts.slice(1).every((n) => n % 2 === 0);
    };
    const solutionOK = (solution, board) => {
      if (!Array.isArray(solution) || solution.length > size / 2) return false;
      const seen = new Set();
      return solution.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((i) => {
        if (!Number.isInteger(i) || i < 0 || i >= size || !board[i] || seen.has(i)) return false;
        seen.add(i); return true;
      }) && board[pair[0]] === board[pair[1]]);
    };
    if (!boardOK(state.board) || !solutionOK(state.solution, state.board)) return false;
    if (!Array.isArray(state.history) || state.history.length > HISTORY_LIMIT) return false;
    if (!state.history.every((h) => h && boardOK(h.board) && solutionOK(h.solution, h.board)
      && Number.isInteger(h.moves) && h.moves >= 0 && h.moves === (size - h.board.filter(Boolean).length) / 2)) return false;
    return ['moves', 'mistakes', 'hintsUsed', 'undoUsed', 'shufflesUsed'].every((key) => Number.isSafeInteger(state[key]) && state[key] >= 0)
      && state.moves === size / 2 - remaining(state)
      && Number.isInteger(state.shuffleSeed) && state.shuffleSeed >= 0 && state.shuffleSeed <= 0xffffffff
      && Number.isFinite(state.elapsed) && state.elapsed >= 0 && typeof state.started === 'boolean';
  }

  return { SYMBOLS, DIFFICULTIES, DAILY_DIFFICULTY, HISTORY_LIMIT, create, findPath, findPair,
    verifySolution, remove, undo, reshuffle, remaining, isDone, isValid };
})();
if (typeof module !== 'undefined') module.exports = SichuanGame;
