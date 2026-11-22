// 블록 쌓기 규칙: 10×20 판, 네 칸짜리 조각 7가지. 가로줄을 채우면 사라진다.
// 조각 순서는 '7개 묶음'(7가지를 한 번씩 섞어 내고 다시 섞음)으로, 저장 가능한 난수(state.rng)를 쓴다.
// → 매일 도전은 누구나 같은 조각 순서. 시간 흐름(자동 낙하·바닥에 닿은 뒤 잠깐 기다림)은 ui.js가 맡는다.
const Blocks = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const COLS = 10;
  const ROWS = 20;

  // 조각: 상자 크기와 기본 모양(칸 좌표). 이름은 코드 안에서만 쓴다.
  const SHAPES = {
    I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  };
  const TYPES = Object.keys(SHAPES);
  const COLOR_OF = Object.fromEntries(TYPES.map((type, i) => [type, i + 1])); // 판에 저장하는 색 번호 1~7

  const DIFFICULTIES = {
    easy: { label: '쉬움', speed: 1000, note: '천천히 떨어져요' },
    medium: { label: '보통', speed: 750, note: '보통 빠르기' },
    hard: { label: '어려움', speed: 480, note: '빠르게 떨어져요' },
  };
  const DAILY_DIFFICULTY = 'medium';
  const LINE_SCORE = [0, 100, 300, 500, 800];
  const LINES_PER_LEVEL = 10;

  // 시계 방향으로 rot번 돌린 칸 좌표
  function cellsOf(type, rot) {
    const { size, cells } = SHAPES[type];
    return cells.map(([x, y]) => {
      let cx = x;
      let cy = y;
      for (let r = 0; r < ((rot % 4) + 4) % 4; r++) [cx, cy] = [size - 1 - cy, cx];
      return [cx, cy];
    });
  }

  function nextType(state) {
    if (!state.bag.length) {
      const bag = TYPES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Common.nextRandom(state) * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      state.bag = bag;
    }
    return state.bag.shift();
  }

  // 판 밖(양옆·바닥)이거나 이미 찬 칸과 겹치면 false. 판 위쪽(y<0)은 비어 있는 것으로 본다.
  function fits(state, piece) {
    return cellsOf(piece.type, piece.rot).every(([cx, cy]) => {
      const x = piece.x + cx;
      const y = piece.y + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      return y < 0 || state.board[y * COLS + x] === 0;
    });
  }

  function spawn(state) {
    const type = state.next;
    state.next = nextType(state);
    const { size } = SHAPES[type];
    state.piece = { type, rot: 0, x: Math.floor((COLS - size) / 2), y: type === 'I' ? -1 : 0 };
    if (!fits(state, state.piece)) state.over = true;
  }

  function create(difficulty, { daily = null, seedText = null } = {}) {
    if (!DIFFICULTIES[difficulty]) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const state = {
      difficulty,
      daily,
      board: new Array(COLS * ROWS).fill(0),
      piece: null,
      next: null,
      bag: [],
      rng: Common.randomState(seedText || `free:${Math.random()}:${Date.now()}`),
      score: 0,
      lines: 0,
      level: 1,
      pieces: 0,
      over: false,
      elapsed: 0,
    };
    state.next = nextType(state);
    spawn(state);
    return state;
  }

  function move(state, dx) {
    if (state.over) return false;
    const moved = { ...state.piece, x: state.piece.x + dx };
    if (!fits(state, moved)) return false;
    state.piece = moved;
    return true;
  }

  // 돌릴 자리가 없으면 옆·위로 조금 밀어 본다(벽 옆에서도 돌릴 수 있게).
  const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];
  function rotate(state, dir = 1) {
    if (state.over) return false;
    for (const [kx, ky] of KICKS) {
      const turned = { ...state.piece, rot: (state.piece.rot + dir + 4) % 4, x: state.piece.x + kx, y: state.piece.y + ky };
      if (fits(state, turned)) {
        state.piece = turned;
        return true;
      }
    }
    return false;
  }

  // 한 칸 내리기. 더 못 내려가면 false (ui.js가 잠깐 기다렸다 lock).
  function stepDown(state) {
    if (state.over) return false;
    const down = { ...state.piece, y: state.piece.y + 1 };
    if (!fits(state, down)) return false;
    state.piece = down;
    return true;
  }

  const canFall = (state) => !state.over && fits(state, { ...state.piece, y: state.piece.y + 1 });

  // 조각이 떨어질 자리(그림자 표시용)
  function ghostY(state) {
    let y = state.piece.y;
    while (fits(state, { ...state.piece, y: y + 1 })) y++;
    return y;
  }

  // 조각을 판에 고정하고, 찬 줄을 지우고, 점수·레벨을 올리고, 다음 조각을 꺼낸다.
  // 결과: { cleared: 지운 줄 번호들, gained: 얻은 점수 }
  function lock(state) {
    if (state.over) return { cleared: [], gained: 0 };
    const color = COLOR_OF[state.piece.type];
    let above = false;
    cellsOf(state.piece.type, state.piece.rot).forEach(([cx, cy]) => {
      const x = state.piece.x + cx;
      const y = state.piece.y + cy;
      if (y < 0) above = true;
      else state.board[y * COLS + x] = color;
    });
    state.pieces++;

    const cleared = [];
    for (let row = 0; row < ROWS; row++) {
      let full = true;
      for (let col = 0; col < COLS; col++) if (!state.board[row * COLS + col]) { full = false; break; }
      if (full) cleared.push(row);
    }
    if (cleared.length) {
      const keep = [];
      for (let row = 0; row < ROWS; row++) {
        if (!cleared.includes(row)) keep.push(...state.board.slice(row * COLS, row * COLS + COLS));
      }
      state.board = new Array(cleared.length * COLS).fill(0).concat(keep);
    }
    const gained = LINE_SCORE[cleared.length] * state.level;
    state.score += gained;
    state.lines += cleared.length;
    state.level = 1 + Math.floor(state.lines / LINES_PER_LEVEL);

    if (above) state.over = true; // 판 위로 넘쳐 쌓임
    else spawn(state);
    return { cleared, gained };
  }

  // 바로 떨어뜨리기: 내려간 칸 수 ×2점
  function hardDrop(state) {
    if (state.over) return { cleared: [], gained: 0 };
    const target = ghostY(state);
    const dropped = target - state.piece.y;
    state.piece = { ...state.piece, y: target };
    state.score += dropped * 2;
    return lock(state);
  }

  // 자동 낙하 간격(ms): 레벨이 오를 때마다 15%씩 빨라지고 0.1초보다 빨라지지 않는다.
  function interval(state) {
    return Math.max(100, Math.round(DIFFICULTIES[state.difficulty].speed * 0.85 ** (state.level - 1)));
  }

  function isValid(state) {
    return Boolean(state) && typeof state === 'object'
      && DIFFICULTIES[state.difficulty] !== undefined
      && Array.isArray(state.board) && state.board.length === COLS * ROWS
      && state.piece && TYPES.includes(state.piece.type) && TYPES.includes(state.next)
      && Array.isArray(state.bag) && Number.isInteger(state.rng)
      && Number.isInteger(state.score) && Number.isFinite(state.elapsed);
  }

  return {
    COLS, ROWS, TYPES, DIFFICULTIES, DAILY_DIFFICULTY, LINE_SCORE, COLOR_OF,
    cellsOf, fits, create, move, rotate, stepDown, canFall, ghostY, lock, hardDrop, interval, isValid,
  };
})();

if (typeof module !== 'undefined') module.exports = Blocks;
