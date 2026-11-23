// 오목 규칙과 컴퓨터. 13×13 판, 나는 흑(먼저), 컴퓨터는 백. 가로·세로·대각선으로 5개 이상 이으면 승리(금수 없음).
// 컴퓨터는 빈칸마다 '내가 두면 몇 개가 이어지나(공격)·상대가 두면 몇 개가 이어지나(막기)'를 점수로 매겨 고른다.
// 같은 점수끼리는 저장 가능한 난수(state.rng)로 고르므로, 오늘의 도전은 같은 수를 두면 같은 결과가 나온다.
const Omok = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const SIZE = 13;
  const CELLS = SIZE * SIZE;
  const BLACK = 1; // 나
  const WHITE = 2; // 컴퓨터
  const DIFFICULTIES = {
    easy: { label: '쉬움', undo: 3, note: '컴퓨터가 가끔 실수해요 · 무르기 3번' },
    medium: { label: '보통', undo: 1, note: '막을 곳은 잘 막아요 · 무르기 1번' },
    hard: { label: '어려움', undo: 0, note: '한 수 앞을 내다봐요 · 무르기 없음' },
  };
  const DAILY_DIFFICULTY = 'medium';
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const at = (x, y) => y * SIZE + x;
  const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

  function create(difficulty = 'medium', { daily = null, seedText = null } = {}) {
    if (!has(DIFFICULTIES, difficulty)) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const state = {
      version: 1, difficulty, daily,
      board: new Array(CELLS).fill(0),
      opening: [], moves: [], // opening: 오늘의 도전에서 미리 놓인 돌 [칸, 색]
      undoLeft: DIFFICULTIES[difficulty].undo,
      over: false, winner: 0, line: null, elapsed: 0,
      rng: Common.randomState(seedText || (daily ? `maeil-omok:${daily}` : `omok:${Date.now()}:${Math.random()}`)),
    };
    // 오늘의 도전: 가운데 근처에 흑·백 한 개씩 놓고 시작(날마다 다른 첫 모양)
    if (daily) {
      const c = Math.floor(SIZE / 2);
      const pick = () => c - 1 + Math.floor(Common.nextRandom(state) * 3);
      const black = at(pick(), pick());
      let white = black;
      while (white === black) white = at(pick(), pick());
      state.board[black] = BLACK;
      state.board[white] = WHITE;
      state.opening = [[black, BLACK], [white, WHITE]];
    }
    return state;
  }

  // idx를 지나는 방향 (dx,dy)의 같은 색 연속 수와 양 끝이 비었는지
  function runAt(board, idx, color, dx, dy) {
    const x0 = idx % SIZE;
    const y0 = Math.floor(idx / SIZE);
    let count = 1;
    let open = 0;
    const cells = [idx];
    for (const sign of [1, -1]) {
      let x = x0 + dx * sign;
      let y = y0 + dy * sign;
      while (inside(x, y) && board[at(x, y)] === color) {
        cells.push(at(x, y));
        count++;
        x += dx * sign;
        y += dy * sign;
      }
      if (inside(x, y) && board[at(x, y)] === 0) open++;
    }
    return { count, open, cells };
  }

  // idx에 놓인 돌로 5개 이상 이어졌으면 그 칸들
  function winLine(board, idx) {
    const color = board[idx];
    if (!color) return null;
    for (const [dx, dy] of DIRS) {
      const run = runAt(board, idx, color, dx, dy);
      if (run.count >= 5) return run.cells.sort((a, b) => a - b);
    }
    return null;
  }

  function place(state, idx, color) {
    state.board[idx] = color;
    state.moves.push(idx);
    const line = winLine(state.board, idx);
    if (line) {
      state.over = true;
      state.winner = color;
      state.line = line;
    } else if (state.board.every((v) => v !== 0)) {
      state.over = true;
      state.winner = 0; // 무승부(판이 다 참)
    }
  }

  // 내 차례: 흑을 둔다. 둘 수 없으면 false
  function play(state, idx) {
    if (state.over || !Number.isInteger(idx) || idx < 0 || idx >= CELLS || state.board[idx] !== 0) return false;
    if (state.moves.length % 2 !== 0) return false; // 컴퓨터 차례
    place(state, idx, BLACK);
    return true;
  }

  // ---------- 컴퓨터 ----------
  // 한 방향 모양 점수: 이어진 수와 열린 끝 수
  function shape(count, open) {
    if (count >= 5) return 100000;
    if (open === 0) return 0;
    if (count === 4) return open === 2 ? 12000 : 1500;
    if (count === 3) return open === 2 ? 1200 : 120;
    if (count === 2) return open === 2 ? 100 : 12;
    return open === 2 ? 4 : 1;
  }

  // 빈칸 idx에 color를 둔다고 할 때의 점수(네 방향 합). 열린 4·열린 3이 겹치면 더 높게.
  function cellScore(board, idx, color) {
    board[idx] = color;
    let total = 0;
    let strong = 0;
    for (const [dx, dy] of DIRS) {
      const { count, open } = runAt(board, idx, color, dx, dy);
      const s = shape(count, open);
      if (s >= 1200) strong++;
      total += s;
    }
    board[idx] = 0;
    if (strong >= 2 && total < 100000) total += 8000; // 쌍삼·사삼: 막기 어려운 수
    return total;
  }

  // 돌 근처(2칸 안)의 빈칸만 후보로 본다. 판이 비었으면 가운데.
  function candidates(board) {
    const list = [];
    for (let i = 0; i < CELLS; i++) {
      if (board[i] !== 0) continue;
      const x = i % SIZE;
      const y = Math.floor(i / SIZE);
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (inside(x + dx, y + dy) && board[at(x + dx, y + dy)] !== 0) { near = true; break; }
        }
      }
      if (near) list.push(i);
    }
    return list.length ? list : [at(Math.floor(SIZE / 2), Math.floor(SIZE / 2))];
  }

  function ranked(board, me, defenseWeight) {
    const foe = me === WHITE ? BLACK : WHITE;
    return candidates(board).map((idx) => {
      const attack = cellScore(board, idx, me);
      const defense = cellScore(board, idx, foe);
      return { idx, attack, defense, score: attack * 1.1 + defense * defenseWeight };
    }).sort((a, b) => b.score - a.score || a.idx - b.idx);
  }

  // 같은 점수 묶음에서 난수로 하나
  function pickTop(state, list, spread = 0) {
    const best = list[0].score;
    const pool = list.filter((c) => c.score >= best * (1 - spread) - 1e-9);
    return pool[Math.floor(Common.nextRandom(state) * pool.length)].idx;
  }

  function chooseMove(state) {
    const board = state.board;
    const list = ranked(board, WHITE, 1);
    const win = list.find((c) => c.attack >= 100000);
    if (win) return win.idx;
    const mustBlock = list.find((c) => c.defense >= 100000);
    const level = state.difficulty;

    if (level === 'easy') {
      // 쉬움: 상대 5목은 대개 막지만(85%), 그 밖에는 상위 몇 수 중 아무거나 → 빈틈이 생긴다
      if (mustBlock && Common.nextRandom(state) < 0.85) return mustBlock.idx;
      const pool = list.slice(0, 4);
      return pool[Math.floor(Common.nextRandom(state) * pool.length)].idx;
    }
    if (mustBlock) return mustBlock.idx;
    if (level === 'medium') return pickTop(state, list, 0.04);

    // 어려움: 상위 8수를 두어 보고, 그때 상대의 가장 좋은 응수가 약한 수를 고른다
    const top = list.slice(0, 8);
    let bestScore = -Infinity;
    let pool = [];
    for (const c of top) {
      board[c.idx] = WHITE;
      const replies = ranked(board, BLACK, 1);
      const reply = replies[0];
      // 이 수 다음 내가 만들 수 있는 가장 센 공격(상대가 하나를 막아도 남는 위협이면 이득)
      const mine = replies.reduce((m, r) => Math.max(m, r.defense), 0);
      board[c.idx] = 0;
      // 상대에게 막기 어려운 수(열린 4·쌍삼 이상)를 남기면 크게 감점, 아니면 내 다음 위협을 조금 더한다
      const danger = reply && reply.attack >= 9000 ? reply.attack : 0;
      const value = c.score + mine * 0.15 - danger;
      if (value > bestScore + 1e-9) { bestScore = value; pool = [c.idx]; } else if (Math.abs(value - bestScore) <= 1e-9) pool.push(c.idx);
    }
    return pool[Math.floor(Common.nextRandom(state) * pool.length)];
  }

  // 컴퓨터 차례: 백을 두고 둔 칸을 돌려준다
  function aiMove(state) {
    if (state.over || state.moves.length % 2 !== 1) return -1;
    const idx = chooseMove(state);
    place(state, idx, WHITE);
    return idx;
  }

  // 무르기: 컴퓨터 수와 내 마지막 수를 함께 되돌린다
  function canUndo(state) {
    return !state.over && state.undoLeft > 0 && state.moves.length >= 2 && state.moves.length % 2 === 0;
  }
  function undo(state) {
    if (!canUndo(state)) return false;
    for (let k = 0; k < 2; k++) state.board[state.moves.pop()] = 0;
    state.undoLeft--;
    return true;
  }

  const lastMove = (state) => (state.moves.length ? state.moves[state.moves.length - 1] : -1);
  const playerMoves = (state) => Math.ceil(state.moves.length / 2);

  function isValid(state) {
    if (!state || typeof state !== 'object' || state.version !== 1 || !has(DIFFICULTIES, state.difficulty)) return false;
    if (!Array.isArray(state.board) || state.board.length !== CELLS || !state.board.every((v) => v === 0 || v === 1 || v === 2)) return false;
    if (!Array.isArray(state.moves) || !Array.isArray(state.opening) || !Number.isInteger(state.rng)) return false;
    if (!Number.isInteger(state.undoLeft) || state.undoLeft < 0 || !Number.isFinite(state.elapsed)) return false;
    // 판과 수순이 맞는지 다시 그려 본다
    const board = new Array(CELLS).fill(0);
    for (const [idx, color] of state.opening) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS || board[idx] || (color !== BLACK && color !== WHITE)) return false;
      board[idx] = color;
    }
    for (let i = 0; i < state.moves.length; i++) {
      const idx = state.moves[i];
      if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS || board[idx]) return false;
      board[idx] = i % 2 === 0 ? BLACK : WHITE;
    }
    return board.every((v, i) => v === state.board[i]);
  }

  return { SIZE, CELLS, BLACK, WHITE, DIFFICULTIES, DAILY_DIFFICULTY, create, play, aiMove, chooseMove, winLine, canUndo, undo, lastMove, playerMoves, isValid, cellScore };
})();

if (typeof module !== 'undefined') module.exports = Omok;
