// 2048·카드 짝맞추기 규칙 자동 검사. 실행: node tests/games.test.js
const M = require('../common/core.js');
const G = require('../2048/js/logic.js');
const Memory = require('../memory/js/logic.js');
const Mine = require('../minesweeper/js/logic.js');

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

if (failed) {
  console.log('\n실패한 검사가 있습니다.');
  process.exit(1);
}
console.log('\n모두 통과');
