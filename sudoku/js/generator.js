// 퍼즐 생성기: 완성판을 만들고, 정답이 1개로 유지되는 동안만 숫자를 지워 문제를 만든다.
// 판은 길이 81의 배열이며 빈칸은 0이다.
const SudokuGenerator = (() => {
  const DIFFICULTIES = {
    easy: { label: '쉬움', blanks: 35 },
    medium: { label: '보통', blanks: 45 },
    hard: { label: '어려움', blanks: 52 },
    expert: { label: '매우 어려움', blanks: 58 },
  };

  const ALL_DIGITS = 0b111111111;
  const BOX_OF = Array.from({ length: 81 }, (_, i) =>
    Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
  const BIT_COUNT = Array.from({ length: 512 }, (_, mask) => {
    let count = 0;
    for (let m = mask; m; m &= m - 1) count++;
    return count;
  });

  // 글자(예: 날짜 '2026-11-08')로 정해지는 난수. 같은 글자면 어느 기기에서나 같은 순서가 나온다.
  // '오늘의 문제'를 모두에게 똑같이 내기 위해 쓴다.
  function createSeededRandom(text) {
    let seed = 2166136261;
    for (let i = 0; i < text.length; i++) {
      seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
    }
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, random) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  // 판의 가로줄·세로줄·구역에 쓰인 숫자를 비트로 기록한다. 중복이 있으면 null을 돌려준다.
  function createState(board) {
    const state = {
      board: board.slice(),
      rows: new Array(9).fill(0),
      cols: new Array(9).fill(0),
      boxes: new Array(9).fill(0),
      empties: [],
    };
    for (let i = 0; i < 81; i++) {
      const digit = board[i];
      if (digit === 0) {
        state.empties.push(i);
        continue;
      }
      const bit = 1 << (digit - 1);
      const row = Math.floor(i / 9);
      const col = i % 9;
      const box = BOX_OF[i];
      if ((state.rows[row] | state.cols[col] | state.boxes[box]) & bit) return null;
      state.rows[row] |= bit;
      state.cols[col] |= bit;
      state.boxes[box] |= bit;
    }
    return state;
  }

  // 백트래킹: 후보가 가장 적은 칸부터 숫자를 넣어 보고, 막히면 되돌아간다.
  // onSolved가 true를 돌려주면 탐색을 멈춘다. pickDigits로 숫자를 시도할 순서를 정한다.
  function search(state, remaining, pickDigits, onSolved) {
    if (remaining === 0) return onSolved();

    const { empties, rows, cols, boxes, board } = state;
    let bestSlot = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let slot = 0; slot < remaining; slot++) {
      const i = empties[slot];
      const used = rows[Math.floor(i / 9)] | cols[i % 9] | boxes[BOX_OF[i]];
      const mask = ALL_DIGITS & ~used;
      const count = BIT_COUNT[mask];
      if (count < bestCount) {
        bestSlot = slot;
        bestMask = mask;
        bestCount = count;
        if (count <= 1) break;
      }
    }
    if (bestCount === 0) return false;

    const last = remaining - 1;
    const cell = empties[bestSlot];
    empties[bestSlot] = empties[last];
    empties[last] = cell;

    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const box = BOX_OF[cell];
    let stopped = false;
    for (const bit of pickDigits(bestMask)) {
      rows[row] |= bit;
      cols[col] |= bit;
      boxes[box] |= bit;
      board[cell] = 31 - Math.clz32(bit) + 1;
      stopped = search(state, last, pickDigits, onSolved);
      rows[row] &= ~bit;
      cols[col] &= ~bit;
      boxes[box] &= ~bit;
      if (stopped) break;
      board[cell] = 0;
    }

    empties[last] = empties[bestSlot];
    empties[bestSlot] = cell;
    return stopped;
  }

  function digitBits(mask) {
    const bits = [];
    for (let m = mask; m; m &= m - 1) bits.push(m & -m);
    return bits;
  }

  // 정답 개수를 limit개까지만 센다. 정답이 1개인지 확인할 때는 2까지만 세면 충분하다.
  function countSolutions(board, limit = 2) {
    const state = createState(board);
    if (!state) return 0;
    let count = 0;
    search(state, state.empties.length, digitBits, () => {
      count++;
      return count >= limit;
    });
    return count;
  }

  function generateSolvedBoard(random = Math.random) {
    const state = createState(new Array(81).fill(0));
    search(state, 81, (mask) => shuffle(digitBits(mask), random), () => true);
    return state.board;
  }

  // 무작위 순서로 숫자를 지운다. 지웠을 때 정답이 여러 개가 되면 그 숫자는 되살린다.
  function digHoles(solution, blanks, random) {
    const puzzle = solution.slice();
    const order = shuffle(Array.from({ length: 81 }, (_, i) => i), random);
    let removed = 0;
    for (const i of order) {
      if (removed === blanks) break;
      const digit = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) === 1) removed++;
      else puzzle[i] = digit;
    }
    return removed === blanks ? puzzle : null;
  }

  // 목표 빈칸 수에 도달하지 못한 완성판은 버리고 새 완성판으로 다시 시도한다.
  // random을 넘기지 않으면 매번 다른 문제, 같은 난수를 넘기면 항상 같은 문제가 나온다.
  function generatePuzzle(difficulty, random = Math.random) {
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    for (;;) {
      const solution = generateSolvedBoard(random);
      const puzzle = digHoles(solution, config.blanks, random);
      if (puzzle) return { difficulty, puzzle, solution };
    }
  }

  // 오늘의 문제: 날짜(예: '2026-11-08')마다 정해진 '보통' 난이도 문제
  const DAILY_DIFFICULTY = 'medium';
  function generateDailyPuzzle(dateKey) {
    return generatePuzzle(DAILY_DIFFICULTY, createSeededRandom(`maeil-sudoku:${dateKey}`));
  }

  return {
    DIFFICULTIES, DAILY_DIFFICULTY, countSolutions, generateSolvedBoard, generatePuzzle,
    generateDailyPuzzle, createSeededRandom,
  };
})();

if (typeof module !== 'undefined') module.exports = SudokuGenerator;
