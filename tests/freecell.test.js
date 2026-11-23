const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../freecell/js/logic.js');
const D = require('../freecell/js/deals.js');
const M = require('../common/core.js');
const copy = (s) => JSON.parse(JSON.stringify(s));
const card = (suit, rank) => suit * 13 + rank - 1;

// 제품의 묶음 이동·수용량 계산을 사용하지 않는, 한 장 이동 전용 규칙 검사.
function single(s, from, to) {
  const source = from.type === 'free' ? s.free[from.index] : s.columns[from.index].at(-1);
  assert.notEqual(source, null); assert.notEqual(source, undefined);
  const suit = Math.floor(source / 13), rank = source % 13 + 1;
  if (to.type === 'free') assert.equal(s.free[to.index], null);
  else if (to.type === 'foundation') { assert.equal(suit, to.index); assert.equal(rank, s.foundations[to.index] + 1); }
  else {
    const parent = s.columns[to.index].at(-1);
    if (parent !== undefined) {
      assert.equal(parent % 13 + 1, rank + 1);
      assert.notEqual(Math.floor(parent / 13) % 2, suit % 2);
    }
  }
  if (from.type === 'free') s.free[from.index] = null; else s.columns[from.index].pop();
  if (to.type === 'free') s.free[to.index] = source;
  else if (to.type === 'foundation') s.foundations[to.index]++;
  else s.columns[to.index].push(source);
}
function expand(s, move) {
  const { from, to } = move;
  if (from.type !== 'column' || to.type !== 'column') { single(s, from, to); return; }
  const n = s.columns[from.index].length - from.start;
  const free = s.free.map((v, i) => v === null ? i : -1).filter((i) => i >= 0);
  const empty = s.columns.map((c,i) => !c.length && i !== to.index && i !== from.index ? i : -1).filter((i) => i >= 0);
  function transfer(source, target, count, helpers) {
    if (count <= free.length + 1) {
      const parked = [];
      for (let i = 0; i < count - 1; i++) {
        single(s, { type:'column', index:source }, { type:'free', index:free[i] }); parked.push(free[i]);
      }
      single(s, { type:'column', index:source }, { type:'column', index:target });
      for (const index of parked.reverse()) single(s, { type:'free', index }, { type:'column', index:target });
      return;
    }
    assert.ok(helpers.length > 0, '묶음을 옮길 임시 공간이 부족함');
    const [helper,...rest] = helpers, capacity = (free.length + 1) * 2 ** rest.length;
    const k = Math.min(count - 1, capacity);
    transfer(source, helper, k, rest); transfer(source, target, count - k, rest); transfer(helper, target, k, rest);
  }
  transfer(from.index, to.index, n, empty);
}

test('52장·8줄·프리셀 4칸·완성 칸 4개, 기본 배치 형태', () => {
  const s = G.create('medium', { dealNumber: 123 });
  assert.ok(G.isValid(s)); assert.deepEqual(s.columns.map((c) => c.length).sort(), [6,6,6,6,7,7,7,7]);
  assert.ok(s.free.every((v) => v === null)); assert.deepEqual(s.foundations, [0,0,0,0]);
  assert.equal(G.foundationCount(s), 0); assert.equal(new Set(s.columns.flat()).size, 52);
});

test('같은 무늬 A부터 K까지, 줄은 다른 색 한 단계 작은 카드', () => {
  const s = { columns: [[card(1,7)], [card(0,8)], [card(2,8)], [card(3,8)], [],[],[],[]], free:[null,null,null,null], foundations:[0,0,0,0] };
  const from = { type:'column',index:0,start:0 };
  assert.ok(G.canMove(s, from, {type:'column',index:1}));
  assert.ok(G.canMove(s, from, {type:'column',index:2}));
  assert.equal(G.canMove(s, from, {type:'column',index:3}), false);
  assert.ok(G.canMove(s, from, {type:'column',index:4})); // 빈 줄은 K만이 아니라 아무 카드
  assert.equal(G.canMove(s, from, {type:'foundation',index:1}), false);
  s.columns[0] = [card(1,1)]; assert.ok(G.canMove(s, from, {type:'foundation',index:1}));
  assert.equal(G.canMove(s, from, {type:'foundation',index:0}), false);
});

test('프리셀 한 칸에는 한 장, 완성 칸은 출발점으로 쓰지 않음', () => {
  const s = G.create('medium', { dealNumber: 1 }), from = {type:'column',index:0,start:6};
  from.start = s.columns[0].length-1;
  assert.ok(G.move(s, from, {type:'free',index:0}));
  const second = {type:'column',index:1,start:s.columns[1].length-1};
  assert.equal(G.canMove(s, second, {type:'free',index:0}), false);
  assert.equal(G.sourceCards(s, {type:'foundation',index:0}), null);
  assert.equal(G.canMove(s, {type:'free',index:0}, {type:'free',index:0}), false);
});

test('묶음 이동은 순서·색과 임시 공간에 제한, 빈 목적지는 보조 줄에서 제외', () => {
  const s = { columns: [[card(0,7),card(1,6),card(2,5)], [card(3,8)], [card(0,13)], [card(1,13)], [card(2,13)], [card(3,13)], [card(0,12)], []], free:[card(0,1),card(1,1),null,null], foundations:[0,0,0,0] };
  const from = {type:'column',index:0,start:0};
  assert.equal(G.capacity(s, 1), 6); assert.equal(G.capacity(s, 7), 3);
  assert.ok(G.canMove(s, from, {type:'column',index:7}));
  s.free[2] = card(2,1); assert.equal(G.capacity(s,7), 2);
  assert.equal(G.canMove(s, from, {type:'column',index:7}), false);
  assert.ok(G.canMove(s, from, {type:'column',index:1}));
  s.columns[0][1] = card(2,6); assert.equal(G.sourceCards(s,from), null);
});

test('24개 원본 풀이를 독립적인 한 장 이동으로 끝까지 재검증', () => {
  assert.equal(D.length, 24); assert.equal(new Set(D.map((d) => d.seed)).size, 24);
  for (const deal of D) {
    const initial = G.rawDeal(deal.seed), reference = copy(initial), actual = copy(initial);
    for (const m of deal.solution) {
      expand(reference, m); assert.ok(G.apply(actual,m.from,m.to));
      assert.deepEqual(reference,actual); assert.ok(G.validPosition(actual));
    }
    assert.ok(G.isDone(actual));
  }
});

test('날짜·줄 순서·무늬 변환 후에도 3난이도 365판의 풀이가 유효', () => {
  for (const key of Object.keys(G.DIFFICULTIES)) {
    for (let i = 0; i < 365; i++) {
      const s = G.create(key, { dealNumber:i*9329 });
      assert.ok(G.isValid(s)); assert.ok(G.verifySolution(s.initial,s.solution));
      if (i < 6) {
        const reference = copy(s.initial);
        for (const m of s.solution) expand(reference,m);
        assert.ok(G.isDone(reference));
      }
    }
  }
});

test('같은 난이도·판 번호·날짜는 같은 배치와 풀이', () => {
  const make = (day) => G.create('medium',{daily:day,random:M.dailyRandom('freecell',day)});
  const a = make('2026-11-24'), b = make('2026-11-24'), c = make('2026-11-25');
  assert.deepEqual(a,b); assert.notDeepEqual(a.initial,c.initial);
  assert.deepEqual(G.create('medium',{dealNumber:a.dealNumber}).initial,a.initial);
  assert.throws(() => G.create('unknown')); assert.throws(() => G.create('medium',{dealNumber:-1}));
});

test('잘못된 이동은 기록과 판을 바꾸지 않고 되돌리기는 한 이동 전체 복원', () => {
  const s = G.create('easy',{dealNumber:5}), before = copy(s);
  assert.equal(G.move(s,{type:'column',index:0,start:99},{type:'free',index:0}),false); assert.deepEqual(s,before);
  const m = s.solution[0]; assert.ok(G.move(s,m.from,m.to));
  s.hintsUsed = 1; s.elapsed = 12; const resumed = copy(s); assert.ok(G.isValid(resumed));
  assert.ok(G.undo(resumed)); assert.deepEqual(G.snapshot(resumed),G.snapshot(before));
  assert.equal(resumed.hintsUsed,1); assert.equal(resumed.elapsed,12); assert.equal(resumed.undoUsed,1); assert.equal(resumed.moves,0);
});

test('자동 정리는 안전 조건을 만족하는 카드만, 여러 장도 한 번에 되돌림', () => {
  const s = G.create('easy',{dealNumber:1});
  while (!G.safeMove(s)) { const m=G.hint(s,G.solutionMap(s)); G.move(s,m.from,m.to); }
  const before = copy(s), count = G.autoFoundation(s);
  assert.ok(count > 0); assert.equal(s.moves,before.moves+count); assert.ok(G.isValid(s));
  G.undo(s); assert.deepEqual(G.snapshot(s),G.snapshot(before));
  const example = { foundations:[2,0,1,0] };
  assert.equal(G.safeForFoundation(example,card(0,3)),false);
  example.foundations=[2,2,1,2]; assert.equal(G.safeForFoundation(example,card(0,3)),true);
});

test('검증 경로의 추천은 자동 실행하지 않고 실제 가능한 이동만 반환', () => {
  const s=G.create('hard',{dealNumber:99}), map=G.solutionMap(s), before=copy(s);
  const m=G.hint(s,map); assert.ok(m.certified); assert.deepEqual(s,before); assert.ok(G.canMove(s,m.from,m.to));
  for (const move of s.solution) assert.ok(G.move(s,move.from,move.to));
  assert.ok(G.isDone(s)); assert.ok(G.isValid(s));
});

test('임의 합법 수 100수에서도 카드 52장과 저장·추천 규칙 보존', () => {
  for (let seed=0;seed<20;seed++) {
    const s=G.create('medium',{dealNumber:seed}), random=M.createSeededRandom(`freecell-play:${seed}`), map=G.solutionMap(s);
    for(let i=0;i<100&&!G.isDone(s);i++) {
      const legal=G.legalMoves(s); if(!legal.length)break;
      const hint=G.hint(s,map); assert.ok(hint&&G.canMove(s,hint.from,hint.to));
      const m=legal[Math.floor(random()*legal.length)]; G.move(s,m.from,m.to);
      assert.ok(G.validPosition(s));
      if(i%10===0)assert.ok(G.isValid(copy(s)));
    }
  }
});

test('잘못된 카드·중복·완성 칸·풀이·되돌리기 기록은 복원하지 않음', () => {
  const base=G.create('medium',{dealNumber:31});
  const mutations=[
    (s)=>{s.columns[0][0]=99;}, (s)=>{s.columns[0][0]=s.columns[1][0];},
    (s)=>{s.foundations[0]=14;}, (s)=>{s.free.pop();}, (s)=>{s.solution[0].to.index=99;},
    (s)=>{s.initial.columns[0].pop();}, (s)=>{s.history=[{}];}, (s)=>{s.elapsed=-1;},
    (s)=>{s.moves=-1;}, (s)=>{s.dealNumber=-1;}, (s)=>{s.difficulty='__proto__';},
  ];
  for(const mutate of mutations){const s=copy(base);mutate(s);assert.equal(G.isValid(s),false);}
  for(const value of [null,[],{},false,'save'])assert.equal(G.isValid(value),false);
});
