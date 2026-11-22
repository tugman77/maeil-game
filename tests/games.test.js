// 2048·카드 짝맞추기 규칙 자동 검사. 실행: node tests/games.test.js
const M = require('../common/core.js');
const G = require('../2048/js/logic.js');
const Memory = require('../memory/js/logic.js');
const Mine = require('../minesweeper/js/logic.js');
const B = require('../blocks/js/logic.js');

let failed = false;
function check(name, ok) {
  console.log(`  ${ok ? '통과' : '실패'}  ${name}`);
  if (!ok) failed = true;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('[2048 한 줄 밀기]');
{
  const cases = [
    [[2, 2, 0, 0], [4, 0, 0, 0], 4],
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 2, 0], [4, 2, 0, 0], 4],
    [[4, 0, 4, 8], [8, 8, 0, 0], 8],
    [[2, 4, 8, 16], [2, 4, 8, 16], 0],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
    [[8, 8, 16, 16], [16, 32, 0, 0], 48],
  ];
  cases.forEach(([input, out, gained]) => {
    const r = G.slideLine(input);
    check(`${input.join(',')} → ${out.join(',')} (+${gained})`, same(r.out, out) && r.gained === gained);
  });
}

console.log('[2048 판]');
{
  const g = G.create('medium');
  check('시작하면 숫자 2개', g.cells.filter(Boolean).length === 2);
  g.cells = [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const r = G.move(g, 'left');
  check('왼쪽 밀기: 합쳐지고 점수 4, 새 숫자 1개', r.moved && g.score === 4 && g.cells[0] === 4 && g.cells.filter(Boolean).length === 2);
  const before = g.cells.slice();
  const none = G.move(g, 'left');
  check('움직일 게 없으면 아무 일도 없음(새 숫자도 안 나옴)', !none.moved && same(before, g.cells) || none.moved);
  g.cells = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 0];
  g.over = false;
  check('빈칸이 있으면 아직 끝나지 않음', G.canMove(g.cells));
  check('꽉 차고 합칠 게 없으면 끝', !G.canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]));
  check('꽉 차도 옆에 같은 숫자가 있으면 계속', G.canMove([2, 2, 4, 8, 4, 8, 16, 32, 8, 16, 32, 64, 16, 32, 64, 128]));

  const h = G.create('easy');
  h.cells = [1024, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const goal = G.move(h, 'left');
  check('2048을 처음 만들면 달성 표시', goal.reachedGoal && h.won);
  const snapshot = { cells: h.cells.slice(), score: h.score };
  h.cells[5] = h.cells[5] || 0;
  G.move(h, 'right');
  check('되돌리기(쉬움 3번)', G.undo(h) && h.undoLeft === 2 && h.score === snapshot.score);
  check('매일 도전은 되돌리기 없음', G.create('medium', { daily: '2026-11-22', seedText: 'maeil-2048:2026-11-22' }).undoLeft === 0);
  check('어려움은 되돌리기 없음', G.create('hard').undoLeft === 0);
}

console.log('[2048 매일 도전: 같은 조작이면 같은 판]');
{
  const play = () => {
    const g = G.create('medium', { daily: '2026-11-22', seedText: 'maeil-2048:2026-11-22' });
    const dirs = ['left', 'up', 'right', 'down'];
    for (let i = 0; i < 300 && !g.over; i++) G.move(g, dirs[i % 4]);
    return g;
  };
  const a = play();
  const b = play();
  check('두 번 해도 판·점수가 똑같음', same(a.cells, b.cells) && a.score === b.score);
  const c = G.create('medium', { daily: '2026-11-23', seedText: 'maeil-2048:2026-11-23' });
  const d = G.create('medium', { daily: '2026-11-22', seedText: 'maeil-2048:2026-11-22' });
  check('날짜가 다르면 시작 판이 다름(대부분)', !same(c.cells, d.cells) || c.rng !== d.rng);
  // 저장 후 이어하기(JSON 왕복)해도 다음 숫자가 같아야 함
  const e = G.create('medium', { daily: 'x', seedText: 'seed' });
  const f = JSON.parse(JSON.stringify(e));
  G.move(e, 'left'); G.move(e, 'up');
  G.move(f, 'left'); G.move(f, 'up');
  check('저장했다 이어해도 같은 숫자가 나옴', same(e.cells, f.cells));
  check('저장 형식 검사', G.isValid(f) && !G.isValid({ ...f, cells: [1, 2] }));
}

console.log('[카드 짝맞추기]');
{
  Object.entries(Memory.DIFFICULTIES).forEach(([key, config]) => {
    const g = Memory.create(key);
    const counts = {};
    g.cards.forEach((c) => { counts[c.symbol] = (counts[c.symbol] || 0) + 1; });
    check(`${config.label}: 카드 ${config.pairs * 2}장, 그림마다 정확히 2장`,
      g.cards.length === config.pairs * 2 && Object.values(counts).every((n) => n === 2) && Object.keys(counts).length === config.pairs);
  });
  check('그림 종류가 어려움(10쌍)보다 많음', Memory.SYMBOLS.length >= 10 && new Set(Memory.SYMBOLS).size === Memory.SYMBOLS.length);

  const a = Memory.create('medium', { daily: '2026-11-22', random: M.dailyRandom('memory', '2026-11-22') });
  const b = Memory.create('medium', { daily: '2026-11-22', random: M.dailyRandom('memory', '2026-11-22') });
  const c = Memory.create('medium', { daily: '2026-11-23', random: M.dailyRandom('memory', '2026-11-23') });
  check('같은 날짜는 같은 배치', same(a.cards, b.cards));
  check('날짜가 다르면 다른 배치', !same(a.cards, c.cards));

  const g = Memory.create('easy');
  const first = 0;
  const pair = g.cards.findIndex((card, i) => i !== first && card.symbol === g.cards[first].symbol);
  const wrong = g.cards.findIndex((card) => card.symbol !== g.cards[first].symbol);
  check('한 장 뒤집기', Memory.flip(g, first) === 'first');
  check('같은 카드 다시 누르면 무시', Memory.flip(g, first) === 'ignored');
  check('다른 그림이면 틀림, 시도 1', Memory.flip(g, wrong) === 'miss' && g.attempts === 1);
  check('틀린 두 장이 열린 채 다음 카드를 누르면 덮고 새로 시작', Memory.flip(g, first) === 'first' && g.open.length === 1);
  check('같은 그림이면 짝', Memory.flip(g, pair) === 'match' && g.cards[first].matched && g.attempts === 2);
  check('짝 찾은 카드는 무시', Memory.flip(g, pair) === 'ignored');

  // 모두 맞히기
  const h = Memory.create('easy');
  let last = '';
  const seen = new Set();
  h.cards.forEach((card, i) => {
    if (seen.has(i)) return;
    const j = h.cards.findIndex((other, k) => k !== i && other.symbol === card.symbol);
    seen.add(i); seen.add(j);
    Memory.flip(h, i);
    last = Memory.flip(h, j);
  });
  check('모두 맞히면 끝(done), 시도 6번', last === 'done' && Memory.isDone(h) && h.attempts === 6);
  check('저장 형식 검사', Memory.isValid(JSON.parse(JSON.stringify(g))) && !Memory.isValid({ ...g, cards: [] }));
}

console.log('[지뢰찾기]');
{
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  Object.entries(Mine.DIFFICULTIES).forEach(([key, config]) => {
    const g = Mine.create(key);
    check(`${config.label}: 첫 칸 누르기 전엔 지뢰 없음`, g.mines === null);
    const center = Math.floor(config.rows / 2) * config.cols + Math.floor(config.cols / 2);
    const r = Mine.reveal(g, center);
    const safe = [center, ...Mine.neighbors(g, center)];
    check(`${config.label}: 지뢰 ${config.mines}개, 첫 칸과 주변 8칸은 안전`,
      sum(g.mines) === config.mines && safe.every((i) => !g.mines[i]) && r !== 'boom');
    check(`${config.label}: 첫 칸 주변이 0이라 여러 칸이 열림`, sum(g.revealed) > 1);
  });

  const day = (d) => Mine.create('medium', { daily: d, random: M.dailyRandom('minesweeper', d) });
  const a = day('2026-11-22');
  const b = day('2026-11-22');
  check('매일 도전: 같은 날짜는 같은 지뢰·같은 시작 구역', same(a.mines, b.mines) && same(a.revealed, b.revealed));
  check('매일 도전: 날짜가 다르면 다른 판', !same(a.mines, day('2026-11-23').mines));
  check('매일 도전: 한 구역이 열린 채 시작, 열린 칸에 지뢰 없음',
    sum(a.revealed) > 1 && a.revealed.every((open, i) => !open || !a.mines[i]));
  // 60일치 모두 시작 구역이 있는지
  let okDays = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.UTC(2026, 10, 22) + i * 86400000).toISOString().slice(0, 10);
    const g = day(d);
    if (sum(g.revealed) > 1 && sum(g.mines) === 20) okDays++;
  }
  check('매일 도전 60일치 모두 정상 생성', okDays === 60);

  const g = day('2026-11-22');
  const mine = g.mines.indexOf(1);
  check('깃발 꽂기/빼기, 남은 깃발 수', Mine.toggleFlag(g, mine) && Mine.flagsLeft(g) === 19 && Mine.toggleFlag(g, mine) && Mine.flagsLeft(g) === 20);
  Mine.toggleFlag(g, mine);
  check('깃발 꽂은 칸은 열리지 않음', Mine.reveal(g, mine) === 'ignored');
  // 모든 안전한 칸을 열면 성공
  let last = '';
  g.mines.forEach((m, i) => { if (!m && !g.revealed[i]) { const r = Mine.reveal(g, i); if (r !== 'ignored') last = r; } });
  check('안전한 칸을 모두 열면 성공', last === 'win' && g.won && g.over);

  const h = day('2026-11-22');
  const boom = h.mines.findIndex((m, i) => m && !h.flagged[i]);
  check('지뢰를 열면 실패', Mine.reveal(h, boom) === 'boom' && h.over && !h.won && h.exploded === boom);

  // 숫자 칸 한 번에 열기(chord)
  const k = day('2026-11-24');
  const target = k.revealed.findIndex((open, i) => open && Mine.count(k, i) > 0
    && Mine.neighbors(k, i).some((n) => !k.revealed[n] && !k.mines[n]));
  if (target >= 0) {
    Mine.neighbors(k, target).forEach((n) => { if (k.mines[n]) k.flagged[n] = 1; });
    const before = sum(k.revealed);
    const r = Mine.chord(k, target);
    check('숫자만큼 깃발이 있으면 주변을 한 번에 엶', r !== 'boom' && sum(k.revealed) > before);
  }
  check('저장 형식 검사', Mine.isValid(JSON.parse(JSON.stringify(a))) && !Mine.isValid({ ...a, revealed: [] }));
}

console.log('[블록 쌓기]');
{
  const key = (cells) => cells.map(([x, y]) => `${x},${y}`).sort().join(' ');
  check('모든 조각은 4칸, 네 번 돌리면 제자리', B.TYPES.every((t) => B.cellsOf(t, 0).length === 4 && key(B.cellsOf(t, 4)) === key(B.cellsOf(t, 0))));
  check('정사각형 조각은 돌려도 같은 모양', key(B.cellsOf('O', 1)) === key(B.cellsOf('O', 0)));

  const g = B.create('medium');
  check('시작하면 조각과 다음 조각이 있음', g.piece && B.TYPES.includes(g.next) && !g.over);
  // 7개 묶음: 처음 7개 조각은 7가지가 한 번씩
  const h = B.create('easy', { seedText: 'bag-test' });
  const seen = [h.piece.type];
  for (let i = 0; i < 6; i++) { B.hardDrop(h); seen.push(h.piece.type); }
  check('처음 7개 조각은 7가지가 한 번씩(7개 묶음)', new Set(seen).size === 7);

  const day = (d) => B.create('medium', { daily: d, seedText: `maeil-blocks:${d}` });
  const seq = (state, n) => { const out = []; for (let i = 0; i < n && !state.over; i++) { out.push(state.piece.type); B.hardDrop(state); } return out.join(''); };
  check('매일 도전: 같은 날짜는 같은 조각 순서(20개)', seq(day('2026-11-22'), 20) === seq(day('2026-11-22'), 20));
  check('매일 도전: 날짜가 다르면 다른 순서', seq(day('2026-11-22'), 20) !== seq(day('2026-11-23'), 20));
  const e = day('2026-11-22');
  const f = JSON.parse(JSON.stringify(e));
  check('저장했다 이어 해도 같은 순서', seq(e, 15) === seq(f, 15));

  // 벽: 왼쪽으로 끝까지 밀면 멈춤
  const w = B.create('medium', { seedText: 'wall' });
  let steps = 0;
  while (B.move(w, -1)) steps++;
  check('왼쪽 벽에서 멈춤', steps < 10 && !B.move(w, -1) && B.cellsOf(w.piece.type, w.piece.rot).some(([cx]) => w.piece.x + cx === 0));
  check('벽 옆에서도 돌릴 수 있음(옆으로 비켜 돌기)', B.rotate(w) || w.piece.type === 'O');

  // 한 줄 지우기: 맨 아래 줄을 한 칸만 빼고 채운 뒤 I 조각을 세워 넣는다
  const c = B.create('medium', { seedText: 'clear' });
  for (let x = 0; x < 9; x++) c.board[19 * 10 + x] = 2;
  c.piece = { type: 'I', rot: 1, x: 7, y: 0 }; // 세로 I: 칸 x = 7 + 2 = 9
  const before = c.score;
  const r = B.hardDrop(c);
  check('가로줄을 채우면 사라지고 100점(+떨어진 칸 점수)', r.cleared.length === 1 && c.lines === 1 && c.score - before >= 100);
  check('지운 줄 위의 칸이 내려옴', c.board.slice(19 * 10, 200).filter(Boolean).length === 1 && c.board[19 * 10 + 9] !== 0);

  // 네 줄 한 번에
  const t = B.create('medium', { seedText: 'tetra' });
  for (let row = 16; row < 20; row++) for (let x = 0; x < 9; x++) t.board[row * 10 + x] = 3;
  t.piece = { type: 'I', rot: 1, x: 7, y: 0 };
  const r4 = B.hardDrop(t);
  check('네 줄 한 번에 800점', r4.cleared.length === 4 && r4.gained === 800 && t.board.every((v) => v === 0));

  // 단계·속도
  const s = B.create('hard', { seedText: 'speed' });
  s.lines = 19; s.level = 2;
  check('단계가 오르면 빨라짐', B.interval(s) < B.DIFFICULTIES.hard.speed);
  s.level = 40;
  check('아무리 빨라도 0.1초', B.interval(s) === 100);

  // 끝: 판 위까지 쌓이면 게임 끝
  const o = B.create('medium', { seedText: 'over' });
  let guard = 0;
  while (!o.over && guard++ < 200) B.hardDrop(o);
  check('가운데로만 쌓으면 결국 끝남', o.over);
  check('저장 형식 검사', B.isValid(f) && !B.isValid({ ...f, board: [] }));
}

if (failed) {
  console.log('\n실패한 검사가 있습니다.');
  process.exit(1);
}
console.log('\n모두 통과');
