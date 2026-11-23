// 실행: node --test tests/snake.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../snake/js/logic.js');
const M = require('../common/core.js');
const copy = (state) => JSON.parse(JSON.stringify(state));
const create = () => G.create('medium', { seedText: 'snake-test' });

test('난이도별 시작 상태와 이동 속도', () => {
  for (const difficulty of Object.keys(G.DIFFICULTIES)) {
    const game = G.create(difficulty);
    assert.ok(G.isValid(game));
    assert.equal(game.body.length, 4);
    assert.equal(game.score, 0);
    assert.equal(G.interval(game), G.DIFFICULTIES[difficulty].speed);
    game.eaten = 1000;
    assert.equal(G.interval(game), G.DIFFICULTIES[difficulty].minSpeed);
  }
  assert.throws(() => G.create('__proto__'));
});

test('먹이를 먹으면 성장·점수 증가, 다음 먹이는 몸 밖에 생성', () => {
  const game = create();
  game.food = game.body[0] + 1;
  assert.equal(G.step(game), 'ate');
  assert.equal(game.eaten, 1);
  assert.equal(game.score, 10);
  assert.equal(game.body.length, 5);
  assert.ok(!game.body.includes(game.food));
  assert.ok(G.isValid(game));
});

test('정반대 입력 거절, 빠른 두 번 전환은 두 틱에 나눠 적용', () => {
  const game = create();
  game.food = 0;
  assert.equal(G.turn(game, 'left'), false);
  assert.equal(G.turn(game, 'up'), true);
  assert.equal(G.turn(game, 'down'), false);
  assert.equal(G.turn(game, 'left'), true);
  assert.equal(G.turn(game, 'down'), false); // 예약 두 개 제한
  const head = game.body[0];
  G.step(game);
  assert.equal(game.body[0], head - G.COLS);
  G.step(game);
  assert.equal(game.body[0], head - G.COLS - 1);
  assert.ok(G.isValid(game));
});

test('네 방향의 벽에 닿으면 끝나며 행 사이로 넘어가지 않음', () => {
  const cases = [
    ['right', [143, 142, 141, 140]],
    ['left', [128, 129, 130, 131]],
    ['up', [5, 21, 37, 53]],
    ['down', [245, 229, 213, 197]],
  ];
  for (const [direction, body] of cases) {
    const game = create();
    Object.assign(game, { direction, body, food: 32 });
    assert.ok(G.isValid(game));
    assert.equal(G.step(game), 'over');
    assert.equal(game.reason, 'wall');
    assert.deepEqual(game.body, body);
    assert.equal(G.step(game), 'ignored');
  }
});

test('동시에 비워지는 꼬리 칸에는 들어갈 수 있고, 몸에 닿으면 끝남', () => {
  const tail = create();
  Object.assign(tail, { body: [17, 18, 34, 33], direction: 'left', food: 100 });
  G.turn(tail, 'down');
  assert.equal(G.step(tail), 'moved');
  assert.deepEqual(tail.body, [33, 17, 18, 34]);
  assert.ok(G.isValid(tail));
  const body = create();
  Object.assign(body, { body: [17, 18, 34, 33, 49], direction: 'left', food: 100, eaten: 1, score: 10, moves: 1 });
  G.turn(body, 'down');
  assert.equal(G.step(body), 'over');
  assert.equal(body.reason, 'self');
});

test('마지막 빈칸의 먹이를 먹으면 판 채우기 성공, 먹이 배치 무한 반복 없음', () => {
  const path = [];
  for (let row = 0; row < G.ROWS; row++) {
    for (let col = 0; col < G.COLS; col++) path.push(row * G.COLS + (row % 2 ? G.COLS - 1 - col : col));
  }
  const game = create();
  Object.assign(game, { body: path.slice(1), direction: 'left', food: 0, eaten: 251, score: 2510, moves: 300 });
  assert.ok(G.isValid(game));
  assert.equal(G.step(game), 'won');
  assert.equal(game.body.length, 256);
  assert.equal(game.food, null);
  assert.ok(game.over && game.won && G.isValid(game));
});

test('오늘의 도전은 날짜별 재현 가능, 저장 후 방향 예약·난수 상태도 보존', () => {
  const a = G.create('medium', { daily: '2026-11-23' });
  const b = G.create('medium', { daily: '2026-11-23' });
  assert.deepEqual(a, b);
  assert.notEqual(a.rng, G.create('medium', { daily: '2026-11-24' }).rng);
  a.food = a.body[0] + 1;
  G.step(a);
  G.turn(a, 'up');
  G.turn(a, 'left');
  const restored = copy(a);
  assert.ok(G.isValid(restored));
  for (const direction of ['up', 'left', 'down', 'right', 'down', 'left', 'up', 'right']) {
    assert.equal(G.turn(a, direction), G.turn(restored, direction));
    assert.equal(G.step(a), G.step(restored));
    assert.deepEqual(a, restored);
  }
});

test('60일치 판에서 이동·먹이·저장 상태 불변 조건 확인', () => {
  for (let day = 0; day < 60; day++) {
    const date = new Date(Date.UTC(2026, 10, 23 + day)).toISOString().slice(0, 10);
    const game = G.create('medium', { daily: date });
    const random = M.createSeededRandom(`test:${date}`);
    for (let move = 0; move < 200 && !game.over; move++) {
      G.turn(game, ['up', 'right', 'down', 'left'][Math.floor(random() * 4)]);
      G.step(game);
      assert.ok(G.isValid(copy(game)), `${date}, 이동 ${move}`);
    }
  }
});

test('손상된 저장 데이터는 이어하기 대상으로 받지 않음', () => {
  const game = create();
  for (const bad of [null, [], {}, { ...game, body: [0, 0, 1, 2] }, { ...game, body: [0, 15, 16, 17] },
    { ...game, food: game.body[0] }, { ...game, difficulty: '__proto__' }, { ...game, direction: 'fly' },
    { ...game, queue: ['left'] }, { ...game, score: 999 }, { ...game, elapsed: -1 }, { ...game, rng: 2 ** 40 },
    { ...game, won: true }, { ...game, daily: {} }]) assert.equal(G.isValid(bad), false);
});
