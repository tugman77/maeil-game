// 게임 진행 규칙: 숫자 입력, 메모, 지우기, 되돌리기, 중복 검사, 완성 판정.
// 게임 상태는 숫자 배열로만 이루어져 있어 그대로 저장할 수 있다.
// 메모는 칸마다 하나의 수로 기록한다 (숫자 d가 있으면 d번째 비트가 1).
const Game = (() => {
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

  // 각 칸과 같은 가로줄·세로줄·구역에 있는 칸들 (자기 자신 제외)
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const peers = new Set();
    for (const unit of UNITS) {
      if (unit.includes(i)) unit.forEach((cell) => peers.add(cell));
    }
    peers.delete(i);
    return [...peers];
  });

  const noteBit = (digit) => 1 << (digit - 1);
  const HINTS_PER_GAME = 3;

  // daily: 오늘의 문제면 날짜('2026-11-08'), 일반 게임이면 null
  function create({ difficulty, puzzle, solution }, daily = null) {
    return {
      difficulty,
      daily,
      puzzle: puzzle.slice(),
      solution: solution.slice(),
      values: puzzle.slice(),
      notes: new Array(81).fill(0),
      hinted: new Array(81).fill(false),
      history: [],
      hintsLeft: HINTS_PER_GAME,
      elapsed: 0,
    };
  }

  function isGiven(state, i) {
    return state.puzzle[i] !== 0;
  }

  // 처음 주어진 숫자와 힌트로 공개한 숫자는 고정되어 바꿀 수 없다.
  function isLocked(state, i) {
    return isGiven(state, i) || state.hinted[i];
  }

  function clearNoteFromPeers(state, i, digit) {
    const bit = noteBit(digit);
    PEERS[i].forEach((p) => { state.notes[p] &= ~bit; });
  }

  // 바뀔 칸들의 이전 상태를 한 묶음으로 기록해, 되돌리기 한 번에 함께 복구한다.
  function record(state, cells) {
    state.history.push(cells.map((i) => ({ i, value: state.values[i], notes: state.notes[i] })));
  }

  // 숫자를 쓰면 같은 줄·구역 칸의 메모에서 그 숫자를 자동으로 지운다.
  function setValue(state, i, digit) {
    if (isLocked(state, i) || state.values[i] === digit) return false;
    const bit = noteBit(digit);
    const touchedPeers = PEERS[i].filter((p) => state.notes[p] & bit);
    record(state, [i, ...touchedPeers]);
    state.values[i] = digit;
    state.notes[i] = 0;
    clearNoteFromPeers(state, i, digit);
    return true;
  }

  // 선택한 칸의 정답을 공개한다. 결과: 'ok' | 'locked' | 'correct' | 'none-left'
  // 힌트는 되돌릴 수 없다 (되돌려서 힌트 횟수를 다시 쓰는 것을 막기 위해).
  function useHint(state, i) {
    if (isLocked(state, i)) return 'locked';
    if (state.values[i] === state.solution[i]) return 'correct';
    if (state.hintsLeft <= 0) return 'none-left';
    state.values[i] = state.solution[i];
    state.notes[i] = 0;
    state.hinted[i] = true;
    state.hintsLeft--;
    clearNoteFromPeers(state, i, state.solution[i]);
    return 'ok';
  }

  function toggleNote(state, i, digit) {
    if (isLocked(state, i) || state.values[i] !== 0) return false;
    record(state, [i]);
    state.notes[i] ^= noteBit(digit);
    return true;
  }

  function erase(state, i) {
    if (isLocked(state, i) || (state.values[i] === 0 && state.notes[i] === 0)) return false;
    record(state, [i]);
    state.values[i] = 0;
    state.notes[i] = 0;
    return true;
  }

  // 마지막 동작을 취소하고, 그 동작이 일어난 칸 번호를 돌려준다 (없으면 -1).
  // 그 사이 힌트로 고정된 칸은 되돌리지 않는다.
  function undo(state) {
    const entry = state.history.pop();
    if (!entry) return -1;
    entry.forEach(({ i, value, notes }) => {
      if (state.hinted[i]) return;
      state.values[i] = value;
      state.notes[i] = notes;
    });
    return entry[0].i;
  }

  function hasNote(state, i, digit) {
    return (state.notes[i] & noteBit(digit)) !== 0;
  }

  // 같은 가로줄·세로줄·구역에 같은 숫자가 두 번 이상 있는 칸들
  function conflicts(state) {
    const result = new Set();
    for (const unit of UNITS) {
      const cellsByDigit = {};
      for (const i of unit) {
        const digit = state.values[i];
        if (digit) (cellsByDigit[digit] ||= []).push(i);
      }
      Object.values(cellsByDigit).forEach((cells) => {
        if (cells.length > 1) cells.forEach((i) => result.add(i));
      });
    }
    return result;
  }

  function countDigit(state, digit) {
    return state.values.filter((v) => v === digit).length;
  }

  // 중복 여부와 관계없이 사용자가 입력한 오답만 찾는다. 빈칸·고정 숫자는 제외.
  function mistakes(state) {
    return new Set(state.values.flatMap((value, i) =>
      value !== 0 && !isLocked(state, i) && value !== state.solution[i] ? [i] : []));
  }

  function isFull(state) {
    return state.values.every((v) => v !== 0);
  }

  function isSolved(state) {
    return state.values.every((v, i) => v === state.solution[i]);
  }

  return {
    PEERS, HINTS_PER_GAME, create, isGiven, isLocked, setValue, useHint, toggleNote, erase, undo,
    hasNote, conflicts, mistakes, countDigit, isFull, isSolved,
  };
})();

if (typeof module !== 'undefined') module.exports = Game;
