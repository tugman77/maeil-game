// 2048 규칙: 판은 길이 16 배열(빈칸 0), 밀면 같은 숫자 두 개가 한 번씩 합쳐진다.
// 새 숫자는 저장 가능한 난수(state.rng)로 정해서, 매일 도전은 같은 조작이면 누구나 같은 숫자가 나온다.
const Game2048 = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const SIZE = 4;
  const GOAL = 2048;
  const DIFFICULTIES = {
    easy: { label: '쉬움', undo: 3, four: 0.1, note: '되돌리기 3번' },
    medium: { label: '보통', undo: 1, four: 0.1, note: '되돌리기 1번' },
    hard: { label: '어려움', undo: 0, four: 0.3, note: '되돌리기 없음 · 4가 자주 나옴' },
  };
  const DAILY_DIFFICULTY = 'medium';

  // 방향별로 한 줄씩(밀리는 쪽 칸부터) 칸 번호를 모은다.
  const LINES = {
    left: [], right: [], up: [], down: [],
  };
  for (let n = 0; n < SIZE; n++) {
    const row = [];
    const col = [];
    for (let k = 0; k < SIZE; k++) {
      row.push(n * SIZE + k);
      col.push(k * SIZE + n);
    }
    LINES.left.push(row);
    LINES.right.push(row.slice().reverse());
    LINES.up.push(col);
    LINES.down.push(col.slice().reverse());
  }

  // seedText를 주면(매일 도전) 그 글자로, 아니면 무작위로 난수를 시작한다.
  function create(difficulty, { daily = null, seedText = null } = {}) {
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const state = {
      difficulty,
      daily,
      cells: new Array(SIZE * SIZE).fill(0),
      score: 0,
      moves: 0,
      undoLeft: daily ? 0 : config.undo, // 매일 도전은 모두 같은 조건이 되도록 되돌리기 없음
      history: [],
      rng: Common.randomState(seedText || `free:${Math.random()}:${Date.now()}`),
      won: false,
      over: false,
    };
    spawn(state);
    spawn(state);
    return state;
  }

  // 빈칸 하나에 2(가끔 4)를 넣는다. 난수는 항상 2개씩 쓴다(위치, 숫자).
  function spawn(state) {
    const empties = [];
    state.cells.forEach((value, i) => { if (value === 0) empties.push(i); });
    const pick = Common.nextRandom(state);
    const kind = Common.nextRandom(state);
    if (!empties.length) return -1;
    const index = empties[Math.floor(pick * empties.length)];
    state.cells[index] = kind < DIFFICULTIES[state.difficulty].four ? 4 : 2;
    return index;
  }

  // 한 줄을 민다: [2,2,4,0] → [4,4,0,0], 얻은 점수 4
  // sources: 줄 안에서 각 타일이 어디(k)에서 어디(to)로 갔는지 — 화면에서 미끄러지는 움직임을 그릴 때 쓴다.
  function slideLine(values) {
    const tiles = [];
    values.forEach((v, k) => { if (v !== 0) tiles.push({ v, k }); });
    const out = [];
    const merged = [];
    const sources = [];
    let gained = 0;
    for (let i = 0; i < tiles.length; i++) {
      const to = out.length;
      if (i + 1 < tiles.length && tiles[i].v === tiles[i + 1].v) {
        const value = tiles[i].v * 2;
        merged.push(to);
        sources.push({ from: tiles[i].k, to }, { from: tiles[i + 1].k, to });
        out.push(value);
        gained += value;
        i++;
      } else {
        sources.push({ from: tiles[i].k, to });
        out.push(tiles[i].v);
      }
    }
    while (out.length < values.length) out.push(0);
    return { out, gained, merged, sources };
  }

  function canMove(cells) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 0) return true;
      const col = i % SIZE;
      if (col < SIZE - 1 && cells[i] === cells[i + 1]) return true;
      if (i + SIZE < cells.length && cells[i] === cells[i + SIZE]) return true;
    }
    return false;
  }

  // 결과: { moved, gained, merged: 합쳐진 칸들, spawned: 새 숫자 칸, reachedGoal: 이번에 처음 2048 }
  function move(state, direction) {
    const none = { moved: false, gained: 0, merged: [], moves: [], spawned: -1, reachedGoal: false };
    if (state.over || !LINES[direction]) return none;
    const before = { cells: state.cells.slice(), score: state.score, rng: state.rng, won: state.won };
    const next = state.cells.slice();
    let gained = 0;
    const merged = [];
    const moves = []; // { from: 판 칸, to: 판 칸 } — 움직이지 않은 타일도 포함
    LINES[direction].forEach((line) => {
      const result = slideLine(line.map((i) => state.cells[i]));
      result.out.forEach((value, k) => { next[line[k]] = value; });
      result.merged.forEach((k) => merged.push(line[k]));
      result.sources.forEach(({ from, to }) => moves.push({ from: line[from], to: line[to] }));
      gained += result.gained;
    });
    if (next.every((value, i) => value === state.cells[i])) return none;

    state.history.push(before);
    if (state.history.length > 3) state.history.shift();
    state.cells = next;
    state.score += gained;
    state.moves++;
    const spawned = spawn(state);
    const reachedGoal = !state.won && state.cells.some((value) => value >= GOAL);
    if (reachedGoal) state.won = true;
    state.over = !canMove(state.cells);
    return { moved: true, gained, merged, moves, spawned, reachedGoal };
  }

  function undo(state) {
    if (state.undoLeft <= 0 || !state.history.length) return false;
    const before = state.history.pop();
    Object.assign(state, before, { over: false });
    state.undoLeft--;
    state.moves--;
    return true;
  }

  const maxTile = (state) => Math.max(...state.cells);

  function isValid(state) {
    return Boolean(state) && typeof state === 'object'
      && DIFFICULTIES[state.difficulty] !== undefined
      && Array.isArray(state.cells) && state.cells.length === SIZE * SIZE
      && state.cells.every((v) => Number.isInteger(v) && v >= 0)
      && Number.isInteger(state.score) && Number.isInteger(state.rng)
      && Array.isArray(state.history) && Number.isInteger(state.undoLeft);
  }

  return {
    SIZE, GOAL, DIFFICULTIES, DAILY_DIFFICULTY, create, move, undo, slideLine, canMove, maxTile, isValid,
  };
})();

if (typeof module !== 'undefined') module.exports = Game2048;
