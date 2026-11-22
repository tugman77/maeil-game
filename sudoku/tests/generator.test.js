// 퍼즐 생성기 자동 검사. 실행: node tests/generator.test.js [난이도별 횟수, 기본 100]
// 생성기의 오류를 놓치지 않도록, 규칙 검사와 정답 세기를 생성기 코드와 별도로 구현했다.
const {
  DIFFICULTIES, DAILY_DIFFICULTY, generatePuzzle, generateDailyPuzzle,
} = require('../js/generator.js');

const RUNS = Number(process.argv[2]) || 100;
const TIME_LIMIT_MS = 2000;

const UNITS = [];
for (let n = 0; n < 9; n++) {
  const row = [];
  const col = [];
  const box = [];
  const boxRow = Math.floor(n / 3) * 3;
  const boxCol = (n % 3) * 3;
  for (let k = 0; k < 9; k++) {
    row.push(n * 9 + k);
    col.push(k * 9 + n);
    box.push((boxRow + Math.floor(k / 3)) * 9 + boxCol + (k % 3));
  }
  UNITS.push(row, col, box);
}
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const peers = new Set();
  for (const unit of UNITS) {
    if (unit.includes(i)) unit.forEach((cell) => peers.add(cell));
  }
  peers.delete(i);
  return [...peers];
});

function hasDuplicate(board) {
  return UNITS.some((unit) => {
    const digits = unit.map((i) => board[i]).filter((digit) => digit !== 0);
    return new Set(digits).size !== digits.length;
  });
}

function isCompleteAndValid(board) {
  return board.length === 81
    && board.every((digit) => Number.isInteger(digit) && digit >= 1 && digit <= 9)
    && !hasDuplicate(board);
}

// 찾은 정답을 최대 limit개까지 돌려준다.
function findSolutions(puzzle, limit) {
  const board = puzzle.slice();
  const solutions = [];

  function candidates(i) {
    const used = new Set(PEERS[i].map((peer) => board[peer]));
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => !used.has(digit));
  }

  function solve() {
    let target = -1;
    let options = null;
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const current = candidates(i);
      if (!options || current.length < options.length) {
        target = i;
        options = current;
      }
    }
    if (target === -1) {
      solutions.push(board.slice());
      return;
    }
    for (const digit of options) {
      board[target] = digit;
      solve();
      board[target] = 0;
      if (solutions.length >= limit) return;
    }
  }

  solve();
  return solutions;
}

function inspect(puzzle, solution, blanks) {
  const problems = [];
  if (!isCompleteAndValid(solution) || hasDuplicate(puzzle)) problems.push('rule');
  if (puzzle.filter((digit) => digit === 0).length !== blanks) problems.push('blanks');
  if (puzzle.some((digit, i) => digit !== 0 && digit !== solution[i])) problems.push('mismatch');
  const solutions = findSolutions(puzzle, 2);
  if (solutions.length !== 1 || solutions[0].join('') !== solution.join('')) {
    problems.push('unique');
  }
  return problems;
}

// 검사 코드 자체가 잘못된 문제를 실제로 잡아내는지 먼저 확인한다.
function checkTheChecker() {
  const { puzzle, solution } = generatePuzzle('easy');
  const results = [];

  const clean = inspect(puzzle, solution, DIFFICULTIES.easy.blanks);
  results.push(['정상 문제는 통과', clean.length === 0]);

  const brokenSolution = solution.slice();
  brokenSolution[0] = brokenSolution[1];
  results.push(['규칙을 어긴 완성판을 잡아냄',
    inspect(puzzle, brokenSolution, DIFFICULTIES.easy.blanks).includes('rule')]);

  const wrongBlanks = puzzle.slice();
  wrongBlanks[puzzle.findIndex((digit) => digit !== 0)] = 0;
  results.push(['빈칸 수가 틀린 문제를 잡아냄',
    inspect(wrongBlanks, solution, DIFFICULTIES.easy.blanks).includes('blanks')]);

  // 두 숫자(a, b)가 직사각형을 이루는 네 칸을 비우면 a와 b를 맞바꾼 답도 성립한다.
  const ambiguous = findAmbiguousBoard();
  results.push(['정답이 2개인 문제를 잡아냄',
    inspect(ambiguous.puzzle, ambiguous.solution, ambiguous.blanks).includes('unique')]);

  return results;
}

function findAmbiguousBoard() {
  for (;;) {
    const { solution } = generatePuzzle('easy');
    const puzzle = solution.slice();
    for (let r1 = 0; r1 < 9; r1++) {
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        // 두 가로줄이 같은 세 줄 묶음에 있어야 구역 규칙도 함께 맞바꿔진다.
        if (Math.floor(r1 / 3) !== Math.floor(r2 / 3)) continue;
        for (let c1 = 0; c1 < 9; c1++) {
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            const a = solution[r1 * 9 + c1];
            const b = solution[r1 * 9 + c2];
            if (solution[r2 * 9 + c1] === b && solution[r2 * 9 + c2] === a) {
              [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2]
                .forEach((i) => { puzzle[i] = 0; });
              return { puzzle, solution, blanks: 4 };
            }
          }
        }
      }
    }
  }
}

function runDifficulty(key) {
  const { label, blanks } = DIFFICULTIES[key];
  const row = {
    label, runs: RUNS, rule: 0, blanks: 0, mismatch: 0, unique: 0, slow: 0, total: 0, max: 0,
  };
  for (let run = 0; run < RUNS; run++) {
    const start = process.hrtime.bigint();
    const { puzzle, solution } = generatePuzzle(key);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    row.total += ms;
    row.max = Math.max(row.max, ms);
    if (ms > TIME_LIMIT_MS) row.slow++;
    inspect(puzzle, solution, blanks).forEach((problem) => { row[problem]++; });
  }
  return row;
}

let failed = false;

console.log('[검사 코드 자체 확인]');
for (const [name, ok] of checkTheChecker()) {
  console.log(`  ${ok ? '통과' : '실패'}  ${name}`);
  if (!ok) failed = true;
}

console.log(`\n[난이도별 ${RUNS}회 검사]`);
console.log('난이도 | 횟수 | 규칙 위반 | 빈칸 수 오류 | 정답≠문제 | 정답 1개 아님 | 2초 초과 | 평균(ms) | 최대(ms) | 결과');
for (const key of Object.keys(DIFFICULTIES)) {
  const r = runDifficulty(key);
  const ok = r.rule + r.blanks + r.mismatch + r.unique + r.slow === 0;
  if (!ok) failed = true;
  console.log([
    r.label, r.runs, r.rule, r.blanks, r.mismatch, r.unique, r.slow,
    (r.total / r.runs).toFixed(1), r.max.toFixed(1), ok ? '통과' : '실패',
  ].join(' | '));
}

// 오늘의 문제: 같은 날짜면 항상 같은 문제, 날짜가 다르면 다른 문제여야 한다.
console.log(`\n[오늘의 문제 ${RUNS}일치 검사]`);
const daily = { problems: 0, slow: 0, max: 0, sameDate: true, seen: new Set() };
const firstDay = new Date(2026, 10, 1);
for (let day = 0; day < RUNS; day++) {
  const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + day);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const start = process.hrtime.bigint();
  const a = generateDailyPuzzle(key);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  daily.max = Math.max(daily.max, ms);
  if (ms > TIME_LIMIT_MS) daily.slow++;
  const b = generateDailyPuzzle(key);
  if (a.puzzle.join('') !== b.puzzle.join('') || a.solution.join('') !== b.solution.join('')) {
    daily.sameDate = false;
  }
  daily.seen.add(a.puzzle.join(''));
  daily.problems += inspect(a.puzzle, a.solution, DIFFICULTIES[DAILY_DIFFICULTY].blanks).length;
}
const dailyChecks = [
  ['같은 날짜는 항상 같은 문제', daily.sameDate],
  ['날짜마다 다른 문제', daily.seen.size === RUNS],
  ['규칙 위반·정답 1개 아님 0건', daily.problems === 0],
  [`2초 이내 (최대 ${daily.max.toFixed(1)}ms)`, daily.slow === 0],
];
for (const [name, ok] of dailyChecks) {
  console.log(`  ${ok ? '통과' : '실패'}  ${name}`);
  if (!ok) failed = true;
}

process.exitCode = failed ? 1 : 0;
