const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../sichuan/js/logic.js');
const M = require('../common/core.js');
const copy = (value) => JSON.parse(JSON.stringify(value));

// 제품의 꺾인 선 열거 방식과 독립된 방향별 BFS로 연결 가능 여부를 대조한다.
function bfs(board, rows, cols, a, b) {
  if (a === b || !board[a] || board[a] !== board[b]) return false;
  const width = cols + 2, height = rows + 2;
  const pos = (i) => (Math.floor(i / cols) + 1) * width + i % cols + 1;
  const start = pos(a), end = pos(b);
  const free = (p) => {
    const r = Math.floor(p / width), c = p % width;
    return r === 0 || c === 0 || r === rows + 1 || c === cols + 1
      || p === start || p === end || !board[(r - 1) * cols + c - 1];
  };
  const queue = [], best = Array(width * height * 4).fill(Infinity);
  const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  for (let d = 0; d < 4; d++) { queue.push([start, d, 0]); best[start * 4 + d] = 0; }
  for (let head = 0; head < queue.length; head++) {
    const [p, direction, turns] = queue[head];
    for (let d = 0; d < 4; d++) {
      const n = turns + Number(d !== direction);
      if (n > 2) continue;
      const row = Math.floor(p / width) + dirs[d][0], col = p % width + dirs[d][1];
      if (row < 0 || row >= height || col < 0 || col >= width) continue;
      const next = row * width + col;
      if (!free(next) || best[next * 4 + d] <= n) continue;
      if (next === end) return true;
      best[next * 4 + d] = n; queue.push([next, d, n]);
    }
  }
  return false;
}

test('직선·한 번 꺾임·두 번 꺾임과 바깥 통로', () => {
  assert.equal(G.findPath([1, 0, 1], 1, 3, 0, 2).length, 2);
  assert.equal(G.findPath([1, 0, 2, 1], 2, 2, 0, 3).length, 3);
  const board = [1, 2, 1, 3, 4, 5];
  const route = G.findPath(board, 2, 3, 0, 2);
  assert.equal(route.length, 4);
  assert.ok(route.some(([r]) => r === 0));
  assert.equal(G.findPath([1, 2, 3, 1], 2, 2, 0, 3), null);
});

test('서로 다른 패·같은 칸·빈칸·범위 밖은 연결 불가', () => {
  const board = [1, 0, 2, 1];
  for (const [a, b] of [[0, 2], [0, 0], [0, 1], [-1, 3], [0, 99], [0.5, 3]]) {
    assert.equal(G.findPath(board, 2, 2, a, b), null);
  }
});

test('무작위 4,000쌍: 독립 BFS와 연결 가능 여부가 일치하고 역방향도 같다', () => {
  const random = M.createSeededRandom('sichuan-path-reference');
  for (let run = 0; run < 200; run++) {
    const rows = 3 + run % 6, cols = 3 + run % 4;
    const board = Array.from({ length: rows * cols }, () => Math.floor(random() * 4));
    for (let pair = 0; pair < 20; pair++) {
      const a = Math.floor(random() * board.length), b = Math.floor(random() * board.length);
      const path = G.findPath(board, rows, cols, a, b);
      assert.equal(Boolean(path), bfs(board, rows, cols, a, b), `${run}: ${a},${b}`);
      assert.equal(Boolean(path), Boolean(G.findPath(board, rows, cols, b, a)));
      if (path) {
        assert.ok(path.length >= 2 && path.length <= 4);
        for (let i = 1; i < path.length; i++) {
          const p = path[i - 1], q = path[i];
          assert.ok(p[0] === q[0] || p[1] === q[1]);
          const dr = Math.sign(q[0] - p[0]), dc = Math.sign(q[1] - p[1]);
          let r = p[0], c = p[1];
          while (r !== q[0] || c !== q[1]) {
            r += dr; c += dc;
            if (r === 0 || r === rows + 1 || c === 0 || c === cols + 1) continue;
            const index = (r - 1) * cols + c - 1;
            assert.ok(index === a || index === b || !board[index]);
          }
        }
      }
    }
  }
});

test('3난이도 각각 365개 배치: 전체 풀이 검증, 개수·짝수·서로 다른 그림', () => {
  for (const key of Object.keys(G.DIFFICULTIES)) {
    const config = G.DIFFICULTIES[key];
    for (let day = 0; day < 365; day++) {
      const state = G.create(key, { random: M.createSeededRandom(`${key}:${day}`) });
      assert.ok(G.isValid(state));
      assert.equal(state.board.length, config.rows * config.cols);
      assert.equal(new Set(state.board).size, config.types);
      assert.ok(G.verifySolution(state.board, state.rows, state.cols, state.solution));
      for (const [a, b] of state.solution.slice()) {
        assert.ok(G.remove(state, a, b));
        assert.ok(G.isValid(state));
      }
      assert.ok(G.isDone(state));
    }
  }
});

test('같은 한국 날짜는 같은 판, 날짜가 바뀌면 새 판', () => {
  const make = (day) => G.create('medium', { daily: day, random: M.dailyRandom('sichuan', day) });
  const a = make('2026-11-24'), b = make('2026-11-24'), c = make('2026-11-25');
  assert.deepEqual(a, b); assert.notDeepEqual(a.board, c.board);
});

test('잘못된 제거는 아무것도 바꾸지 않고, 힌트 탐색은 저장 상태를 바꾸지 않는다', () => {
  const state = G.create('easy', { random: M.createSeededRandom('no-mutation') });
  const before = copy(state);
  assert.equal(G.remove(state, 0, 0), null); assert.deepEqual(state, before);
  assert.ok(G.findPair(state)); assert.deepEqual(state, before);
});

test('제거·되돌리기·저장 재개 시 패와 풀이가 복원된다', () => {
  const state = G.create('medium', { random: M.createSeededRandom('undo') }), before = copy(state);
  const pair = G.findPair(state); G.remove(state, pair.a, pair.b);
  state.hintsUsed = 1; state.elapsed = 25;
  const resumed = copy(state); assert.ok(G.isValid(resumed));
  assert.ok(G.undo(resumed)); assert.deepEqual(resumed.board, before.board);
  assert.deepEqual(resumed.solution, before.solution);
  assert.equal(resumed.hintsUsed, 1); assert.equal(resumed.elapsed, 25); assert.equal(resumed.undoUsed, 1);
  assert.equal(G.undo(resumed), false);
});

// 짝은 남지만 연결할 수 없는 합법적인 플레이 수순을 찾는다.
let stuck;
function stuckGame() {
  if (stuck) return copy(stuck);
  for (let seed = 0; seed < 300; seed++) {
    const random = M.createSeededRandom(`deadlock:${seed}`), state = G.create('hard', { random });
    while (!G.isDone(state)) {
      const pairs = [];
      for (let a = 0; a < state.board.length; a++) {
        for (let b = a + 1; b < state.board.length; b++) {
          if (G.findPath(state.board, state.rows, state.cols, a, b)) pairs.push([a, b]);
        }
      }
      if (!pairs.length) { stuck = copy(state); return copy(stuck); }
      const pair = pairs[Math.floor(random() * pairs.length)]; G.remove(state, ...pair);
    }
  }
  throw new Error('막힘 검사 판을 찾지 못했습니다.');
}

test('막힌 판의 재배치는 패 개수·종류·빈자리를 보존하고 끝까지 풀린다', () => {
  const state = stuckGame(), before = copy(state), another = copy(state);
  assert.ok(G.isValid(state)); assert.equal(G.findPair(state), null);
  assert.ok(G.reshuffle(state)); assert.ok(G.reshuffle(another));
  assert.deepEqual(state, another);
  assert.deepEqual(state.board.map(Boolean), before.board.map(Boolean));
  assert.deepEqual(state.board.slice().sort(), before.board.slice().sort());
  assert.equal(state.moves, before.moves); assert.equal(state.shufflesUsed, 1);
  assert.ok(G.verifySolution(state.board, state.rows, state.cols, state.solution));
  assert.ok(G.isValid(state));
  G.undo(state); assert.deepEqual(state.board, before.board); assert.equal(state.shufflesUsed, 1);
  G.reshuffle(state); assert.equal(state.shufflesUsed, 2);
  for (const pair of state.solution.slice()) G.remove(state, ...pair);
  assert.ok(G.isDone(state));
});

test('연결할 짝이 있거나 완료한 판은 재배치하지 않는다', () => {
  const state = G.create('easy'); const before = copy(state);
  assert.equal(G.reshuffle(state), false); assert.deepEqual(state, before);
  for (const pair of state.solution.slice()) G.remove(state, ...pair);
  assert.equal(G.reshuffle(state), false);
});

test('손상된 저장·홀수 그림·잘못된 풀이·무르기 기록을 거부한다', () => {
  const valid = G.create('medium');
  const mutations = [
    (s) => { s.rows = 2; }, (s) => { s.board[0] = 99; }, (s) => { s.board[0] = 0; },
    (s) => { s.solution[0] = [0, 0]; }, (s) => { s.elapsed = -1; },
    (s) => { s.moves = 1; }, (s) => { s.daily = '오늘'; }, (s) => { s.hintsUsed = Infinity; },
    (s) => { s.history = [{}]; }, (s) => { s.shuffleSeed = -1; },
  ];
  assert.ok(G.isValid(valid));
  for (const mutate of mutations) { const s = copy(valid); mutate(s); assert.equal(G.isValid(s), false); }
  for (const bad of [null, false, [], '저장', {}]) assert.equal(G.isValid(bad), false);
});

module.exports.stuckGame = stuckGame;
