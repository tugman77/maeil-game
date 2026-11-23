// 리버시: 8×8, 흑 선공, 놓을 수 없으면 자동 패스, 양쪽 모두 둘 수 없으면 종료.
// 화면·시간과 독립된 규칙 및 결정적인 탐색. Node 검사와 Web Worker에서도 같은 코드를 쓴다.
const Reversi = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const SIZE = 8, CELLS = 64, BLACK = 1, WHITE = 2;
  const DIRS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  const CORNERS = [0, 7, 56, 63];
  const WEIGHTS = [
    120,-30,20,5,5,20,-30,120, -30,-60,-5,-5,-5,-5,-60,-30,
    20,-5,15,3,3,15,-5,20, 5,-5,3,3,3,3,-5,5,
    5,-5,3,3,3,3,-5,5, 20,-5,15,3,3,15,-5,20,
    -30,-60,-5,-5,-5,-5,-60,-30, 120,-30,20,5,5,20,-30,120,
  ];
  const DIFFICULTIES = {
    easy: { label: '쉬움', depth: 1, nodes: 1000, note: '한 수씩 살펴보는 상대 · 무르기 제한 없음' },
    medium: { label: '보통', depth: 3, nodes: 8000, note: '모서리와 다음 수를 살펴요 · 무르기 제한 없음' },
    hard: { label: '어려움', depth: 5, nodes: 35000, note: '여러 수를 내다봐요 · 무르기 제한 없음' },
  };
  const DAILY_DIFFICULTY = 'medium';
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  const other = (color) => 3 - color;
  const validBoard = (b) => Array.isArray(b) && b.length === CELLS && b.every((v) => v === 0 || v === BLACK || v === WHITE);
  const validRng = (n) => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;

  function initialBoard() {
    const board = Array(CELLS).fill(0);
    board[27] = board[36] = WHITE;
    board[28] = board[35] = BLACK;
    return board;
  }

  function flips(board, index, color) {
    if (!Number.isInteger(index) || index < 0 || index >= CELLS || board[index] !== 0
      || (color !== BLACK && color !== WHITE)) return [];
    const result = [], x0 = index % SIZE, y0 = Math.floor(index / SIZE);
    for (const [dx, dy] of DIRS) {
      let x = x0 + dx, y = y0 + dy;
      const line = [];
      while (inside(x, y) && board[y * SIZE + x] === other(color)) {
        line.push(y * SIZE + x); x += dx; y += dy;
      }
      if (line.length && inside(x, y) && board[y * SIZE + x] === color) result.push(...line);
    }
    return result;
  }

  function legalMoves(board, color) {
    const result = [];
    for (let index = 0; index < CELLS; index++) {
      if (board[index] !== 0) continue;
      const captured = flips(board, index, color);
      if (captured.length) result.push({ index, flips: captured });
    }
    return result;
  }

  function counts(board) {
    let black = 0, white = 0;
    board.forEach((v) => { if (v === BLACK) black++; else if (v === WHITE) white++; });
    return { black, white, empty: CELLS - black - white };
  }

  function afterMove(board, move, color) {
    const next = board.slice();
    next[move.index] = color;
    for (const index of move.flips) next[index] = color;
    return next;
  }

  function advance(state, move, color) {
    state.board = afterMove(state.board, move, color);
    state.lastMove = move.index;
    state.lastPassed = 0;
    const foe = other(color);
    if (legalMoves(state.board, foe).length) state.turn = foe;
    else if (legalMoves(state.board, color).length) {
      state.turn = color;
      state.lastPassed = foe;
    } else {
      const c = counts(state.board);
      state.over = true;
      state.turn = 0;
      state.winner = c.black > c.white ? BLACK : c.white > c.black ? WHITE : 0;
    }
  }

  function create(difficulty = 'medium', { daily = null, seedText = null } = {}) {
    if (!has(DIFFICULTIES, difficulty)) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const state = {
      version: 1, difficulty, daily, board: initialBoard(), turn: BLACK,
      opening: [], moves: [], history: [], lastMove: -1, lastPassed: 0,
      over: false, winner: 0, elapsed: 0, undoUsed: 0, hintsUsed: 0,
      rng: Common.randomState(seedText || (daily ? `maeil-reversi:${daily}` : `reversi:${Date.now()}:${Math.random()}`)),
    };
    // 오늘의 도전은 합법적인 네 수를 먼저 둔다. 같은 날짜에는 기기와 무관하게 같은 판.
    if (daily) {
      for (let n = 0; n < 4; n++) {
        const color = state.turn;
        const list = legalMoves(state.board, color);
        const move = list[Math.floor(Common.nextRandom(state) * list.length)];
        state.opening.push([move.index, color]);
        advance(state, move, color);
      }
    }
    return state;
  }

  function snapshot(state) {
    return { board: state.board.slice(), turn: state.turn, rng: state.rng,
      moveLength: state.moves.length, lastMove: state.lastMove, lastPassed: state.lastPassed };
  }

  function play(state, index) {
    if (state.over || state.turn !== BLACK) return false;
    const captured = flips(state.board, index, BLACK);
    if (!captured.length) return false;
    state.history.push(snapshot(state));
    state.moves.push([index, BLACK]);
    advance(state, { index, flips: captured }, BLACK);
    return true;
  }

  function aiMove(state, index = null) {
    if (state.over || state.turn !== WHITE) return -1;
    if (index === null) index = chooseMove(state);
    const captured = flips(state.board, index, WHITE);
    if (!captured.length) return -1;
    state.moves.push([index, WHITE]);
    Common.nextRandom(state);
    advance(state, { index, flips: captured }, WHITE);
    return index;
  }

  const canUndo = (state) => !state.over && state.history.length > 0;
  function undo(state) {
    if (!canUndo(state)) return false;
    const previous = state.history.pop();
    Object.assign(state, { board: previous.board.slice(), turn: previous.turn, rng: previous.rng,
      lastMove: previous.lastMove, lastPassed: previous.lastPassed, over: false, winner: 0 });
    state.moves.length = previous.moveLength;
    state.undoUsed++;
    return true;
  }

  // ---------- 컴퓨터: 위치·둘 수 있는 칸·빈칸과 맞닿은 돌을 평가하는 반복 심화 탐색 ----------
  function evaluate(board, color) {
    const c = counts(board), foe = other(color);
    const own = color === BLACK ? c.black : c.white;
    const opposite = color === BLACK ? c.white : c.black;
    let position = 0, frontier = 0;
    const weights = WEIGHTS.slice();
    // 모서리가 찬 뒤에는 그 옆 칸을 빈 모서리 옆과 같은 위험도로 평가하지 않는다.
    for (const corner of CORNERS) {
      if (!board[corner]) continue;
      const x0 = corner % SIZE, y0 = Math.floor(corner / SIZE);
      for (const [dx, dy] of DIRS) {
        const x = x0 + dx, y = y0 + dy;
        if (inside(x, y)) weights[y * SIZE + x] = 12;
      }
    }
    board.forEach((v, index) => {
      if (!v) return;
      const sign = v === color ? 1 : -1;
      position += sign * weights[index];
      const x0 = index % SIZE, y0 = Math.floor(index / SIZE);
      if (DIRS.some(([dx,dy]) => inside(x0+dx,y0+dy) && !board[(y0+dy)*SIZE+x0+dx])) frontier -= sign;
    });
    const mobility = legalMoves(board, color).length - legalMoves(board, foe).length;
    const corners = CORNERS.reduce((sum, i) => sum + (board[i] === color ? 1 : board[i] === foe ? -1 : 0), 0);
    return position + mobility * 12 + frontier * 5 + corners * 160 + (own - opposite) * (c.empty < 16 ? 8 : 1);
  }

  function terminalScore(board, color) {
    const c = counts(board), diff = color === BLACK ? c.black - c.white : c.white - c.black;
    return diff === 0 ? 0 : Math.sign(diff) * 100000 + diff * 100;
  }

  const ordered = (moves) => moves.slice().sort((a,b) => WEIGHTS[b.index] - WEIGHTS[a.index] || b.flips.length - a.flips.length || a.index - b.index);
  function tieKey(index, seed) {
    let value = Math.imul(seed ^ (index + 1), 0x45d9f3b);
    value ^= value >>> 16;
    return value >>> 0;
  }

  // state를 바꾸지 않는다. 노드 수를 제한하여 기기 속도와 무관하게 같은 수를 고른다.
  function chooseMove(state, options = {}) {
    if (state.over || !validBoard(state.board) || ![BLACK, WHITE].includes(state.turn)) return -1;
    const color = state.turn;
    const moves = ordered(legalMoves(state.board, color));
    if (!moves.length) return -1;
    if (moves.length === 1) return moves[0].index;
    const config = DIFFICULTIES[state.difficulty] || DIFFICULTIES.medium;
    const seed = state.rng | 0;
    if (state.difficulty === 'easy' && options.depth === undefined) {
      const corners = moves.filter((m) => CORNERS.includes(m.index));
      const scored = (corners.length ? corners : moves).map((m) => ({ index: m.index, value: evaluate(afterMove(state.board, m, color), color) }))
        .sort((a,b) => b.value-a.value || a.index-b.index);
      const pool = scored.slice(0, Math.min(3, scored.length));
      return pool[tieKey(state.moves?.length || 0, seed) % pool.length].index;
    }
    const empty = counts(state.board).empty;
    const maxDepth = options.depth ?? (state.difficulty === 'hard' && empty <= 8 ? empty : config.depth);
    const maxNodes = options.nodes ?? config.nodes;
    let nodes = 0, aborted = false;
    function search(board, side, depth, alpha, beta) {
      if (++nodes > maxNodes) { aborted = true; return evaluate(board, side); }
      const available = legalMoves(board, side);
      if (!available.length) {
        if (!legalMoves(board, other(side)).length) return terminalScore(board, side);
        // 패스할 때는 빈칸이 줄지 않으므로 탐색 깊이도 줄이지 않는다.
        return -search(board, other(side), depth, -beta, -alpha);
      }
      if (depth <= 0) return evaluate(board, side);
      let best = -Infinity;
      for (const move of ordered(available)) {
        const value = -search(afterMove(board, move, side), other(side), depth - 1, -beta, -alpha);
        best = Math.max(best, value);
        alpha = Math.max(alpha, value);
        if (aborted || alpha >= beta) break;
      }
      return best;
    }
    let bestMove = moves[0].index;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let bestScore = -Infinity, candidate = bestMove;
      const rootMoves = moves.slice().sort((a,b) => Number(b.index === bestMove)-Number(a.index === bestMove));
      for (const move of rootMoves) {
        // 시작 후보는 각각 전체 범위로 평가하여 가지치기 경계값을 동점으로 오인하지 않는다.
        const value = -search(afterMove(state.board, move, color), other(color), depth - 1, -Infinity, Infinity);
        if (aborted) break;
        if (value > bestScore || (value === bestScore && tieKey(move.index, seed) < tieKey(candidate, seed))) {
          bestScore = value; candidate = move.index;
        }
      }
      if (aborted) break;
      bestMove = candidate;
    }
    return bestMove;
  }

  function isValid(state) {
    if (!state || state.version !== 1 || !has(DIFFICULTIES, state.difficulty) || !validBoard(state.board)
      || !validRng(state.rng) || !Number.isFinite(state.elapsed) || state.elapsed < 0
      || !Number.isInteger(state.undoUsed) || state.undoUsed < 0 || !Number.isInteger(state.hintsUsed) || state.hintsUsed < 0
      || typeof state.over !== 'boolean' || ![0,BLACK,WHITE].includes(state.winner)
      || !Array.isArray(state.opening) || state.opening.length > 4
      || !Array.isArray(state.moves) || state.moves.length > 60 || !Array.isArray(state.history)
      || (state.daily !== null && (typeof state.daily !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.daily)))) return false;
    if (state.opening.length !== (state.daily ? 4 : 0)) return false;
    const replay = { board: initialBoard(), turn: BLACK, over: false, winner: 0, lastMove: -1, lastPassed: 0 };
    let humanMoves = 0;
    for (const [part, tape] of [['opening',state.opening], ['moves',state.moves]]) {
      for (let n = 0; n < tape.length; n++) {
        const pair = tape[n];
        if (!Array.isArray(pair) || pair.length !== 2 || pair[1] !== replay.turn || replay.over) return false;
        if (part === 'moves' && pair[1] === BLACK) {
          const snap = state.history[humanMoves++];
          if (!snap || !validBoard(snap.board) || !validRng(snap.rng) || snap.turn !== BLACK || snap.moveLength !== n
            || snap.lastMove !== replay.lastMove || snap.lastPassed !== replay.lastPassed
            || !snap.board.every((v,i) => v === replay.board[i])) return false;
        }
        const captured = flips(replay.board, pair[0], pair[1]);
        if (!captured.length) return false;
        advance(replay, { index: pair[0], flips: captured }, pair[1]);
      }
    }
    return state.history.length === humanMoves && state.board.every((v,i) => v === replay.board[i])
      && ['turn','over','winner','lastMove','lastPassed'].every((key) => state[key] === replay[key]);
  }

  return { SIZE, CELLS, BLACK, WHITE, DIFFICULTIES, DAILY_DIFFICULTY, initialBoard, flips, legalMoves, counts,
    create, play, aiMove, canUndo, undo, chooseMove, evaluate, isValid };
})();
if (typeof module !== 'undefined') module.exports = Reversi;
