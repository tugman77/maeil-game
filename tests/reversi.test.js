const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../reversi/js/logic.js');
const M = require('../common/core.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const copy = (state) => JSON.parse(JSON.stringify(state));
const create = (difficulty = 'medium') => G.create(difficulty, { seedText: 'reversi-test' });
const playAs = (state, index) => state.turn === G.BLACK ? G.play(state, index) : G.aiMove(state, index);

test('중앙 네 돌과 흑의 네 합법 수, 처음에는 무르기 없음', () => {
  const s = create();
  assert.deepEqual(G.counts(s.board), { black: 2, white: 2, empty: 60 });
  assert.deepEqual(G.legalMoves(s.board, G.BLACK).map((m) => m.index), [19,26,37,44]);
  assert.equal(G.canUndo(s), false);
  assert.ok(G.isValid(copy(s)));
  assert.throws(() => G.create('__proto__'));
});

test('D3 흑 이후 D4가 뒤집히고 백의 합법 수가 바뀜', () => {
  const s = create();
  assert.equal(G.play(s, 19), true);
  assert.equal(s.board[27], G.BLACK);
  assert.deepEqual(G.counts(s.board), { black: 4, white: 1, empty: 59 });
  assert.deepEqual(G.legalMoves(s.board, G.WHITE).map((m) => m.index), [18,20,34]);
  assert.equal(s.turn, G.WHITE);
  assert.equal(G.play(s, 18), false);
  assert.ok(G.isValid(copy(s)));
});

test('가로·세로·대각선 여덟 방향을 동시에 뒤집음', () => {
  const board = Array(64).fill(0);
  const opponents = [18,19,20,26,28,34,35,36];
  const own = [9,11,13,25,29,41,43,45];
  opponents.forEach((i) => { board[i] = G.WHITE; });
  own.forEach((i) => { board[i] = G.BLACK; });
  assert.deepEqual(G.flips(board, 27, G.BLACK).sort((a,b) => a-b), opponents);
});

test('행 경계·빈칸·자기 돌을 건너뛰어 포획하지 않음', () => {
  const board = Array(64).fill(0);
  board[6] = G.BLACK; board[7] = G.WHITE;
  assert.deepEqual(G.flips(board, 8, G.BLACK), []);
  board[6] = 0; board[7] = 0;
  board[1] = G.WHITE; board[3] = G.BLACK;
  assert.deepEqual(G.flips(board, 0, G.BLACK), []);
  board[2] = G.BLACK;
  assert.deepEqual(G.flips(board, 0, G.BLACK), [1]);
  assert.deepEqual(G.flips(board, -1, G.BLACK), []);
  assert.deepEqual(G.flips(board, 64, G.BLACK), []);
  assert.deepEqual(G.flips(board, 0.5, G.BLACK), []);
});

test('잘못된 착수는 판·기록·난수를 바꾸지 않음', () => {
  const s = create(), before = copy(s);
  for (const index of [-1,64,27,0,NaN,'19']) assert.equal(G.play(s,index), false);
  assert.deepEqual(s, before);
  assert.equal(G.aiMove(s,18), -1);
  assert.deepEqual(s, before);
});

test('상대만 둘 곳이 없으면 자동 패스 후 같은 색이 다시 둠', () => {
  const black = create();
  black.board.fill(G.BLACK); black.board[0] = black.board[2] = 0;
  black.board[1] = black.board[9] = G.WHITE;
  assert.ok(G.play(black,0));
  assert.equal(black.turn, G.BLACK);
  assert.equal(black.lastPassed,G.WHITE);
  assert.equal(black.over,false);
  const white = create();
  white.turn = G.WHITE; white.board.fill(G.WHITE); white.board[0] = white.board[2] = 0;
  white.board[1] = white.board[9] = G.BLACK;
  assert.equal(G.aiMove(white,0),0);
  assert.equal(white.turn,G.WHITE);
  assert.equal(white.lastPassed,G.BLACK);
});

test('빈칸이 남아도 양쪽 모두 못 두면 종료, 실제 돌 수로 승패 결정', () => {
  const s = create(); s.board.fill(0); s.board[0]=G.BLACK; s.board[1]=G.WHITE;
  assert.ok(G.play(s,2));
  assert.ok(s.over); assert.equal(s.turn,0); assert.equal(s.winner,G.BLACK);
  assert.deepEqual(G.counts(s.board),{black:3,white:0,empty:61});
  assert.equal(G.play(s,3),false);
});

test('무르기는 내 수와 응수, 난수, 뒤집힌 돌까지 복원', () => {
  const s = create(), before = copy(s);
  G.play(s,19); G.aiMove(s,18);
  assert.ok(G.canUndo(s)); assert.ok(G.undo(s));
  assert.deepEqual(s,{...before,undoUsed:1});
  assert.ok(G.isValid(copy(s)));
  G.play(s,19);
  assert.ok(G.undo(s)); // 컴퓨터가 두기 전에도 무르기 가능
  assert.deepEqual(s.board,before.board);
  assert.equal(s.turn,G.BLACK);
  assert.equal(s.undoUsed,2);
});

test('컴퓨터 탐색은 합법 수를 반환하고 상태를 바꾸지 않음', () => {
  for (const difficulty of Object.keys(G.DIFFICULTIES)) {
    const s = create(difficulty); G.play(s,19);
    const before = copy(s), choice = G.chooseMove(s);
    assert.ok(G.legalMoves(s.board,s.turn).some((m) => m.index===choice));
    assert.deepEqual(s,before);
    assert.equal(G.chooseMove(s),choice);
    assert.equal(G.aiMove(s,choice),choice);
    assert.ok(G.isValid(copy(s)));
  }
});

test('모서리를 잡아 바로 이길 수 있으면 그 수를 선택', () => {
  for (const difficulty of ['easy','medium','hard']) {
    const s=create(difficulty); s.board.fill(0); s.board[1]=G.WHITE; s.board[2]=G.BLACK;
    assert.equal(G.chooseMove(s),0);
  }
});

test('낮은 탐색 예산에서도 합법 수를 반환하고 입력은 보존', () => {
  const s=create('hard'); const before=copy(s);
  const choice=G.chooseMove(s,{depth:8,nodes:1});
  assert.ok(G.legalMoves(s.board,s.turn).some((m)=>m.index===choice));
  assert.deepEqual(s,before);
});

test('100일치 오늘의 도전 시작 판은 합법적이며 날짜별로 재현됨', () => {
  const patterns=new Set();
  for(let day=0;day<100;day++) {
    const date=new Date(Date.UTC(2026,10,23+day)).toISOString().slice(0,10);
    const a=G.create('medium',{daily:date}), b=G.create('medium',{daily:date});
    assert.deepEqual(a,b); assert.ok(G.isValid(a));
    assert.equal(G.counts(a.board).empty,56);
    patterns.add(a.board.join(''));
  }
  assert.ok(patterns.size>10);
});

test('저장 후 같은 수를 두면 컴퓨터 응수와 결과도 동일', () => {
  const a=G.create('medium',{daily:'2026-11-23'}), b=copy(a);
  for(let n=0;n<12&&!a.over;n++) {
    if(a.turn===G.BLACK) {
      const index=G.legalMoves(a.board,G.BLACK)[0].index;
      G.play(a,index); G.play(b,index);
    } else {
      assert.equal(G.aiMove(a),G.aiMove(b));
    }
    assert.deepEqual(a,b); assert.ok(G.isValid(copy(a)));
  }
});

test('100판을 끝까지 진행하며 돌 개수·패스·저장 형식 확인', () => {
  let passes=0, earlyEnds=0;
  for(let seed=0;seed<100;seed++) {
    const s=G.create('medium',{seedText:`random:${seed}`});
    const random=M.createSeededRandom(`moves:${seed}`);
    let previous=4;
    while(!s.over) {
      const legal=G.legalMoves(s.board,s.turn);
      assert.ok(legal.length);
      playAs(s,legal[Math.floor(random()*legal.length)].index);
      const c=G.counts(s.board);
      assert.equal(c.black+c.white,++previous);
      assert.ok(G.isValid(copy(s)));
      if(s.lastPassed)passes++;
    }
    assert.equal(G.legalMoves(s.board,G.BLACK).length,0);
    assert.equal(G.legalMoves(s.board,G.WHITE).length,0);
    const c=G.counts(s.board);
    assert.equal(s.winner,c.black>c.white?G.BLACK:c.white>c.black?G.WHITE:0);
    if(c.empty)earlyEnds++;
  }
  assert.ok(passes>0);
  assert.ok(earlyEnds>0);
});

test('무승부도 패배와 구분해 판정', () => {
  let draw=null;
  for(let seed=0;seed<150&&!draw;seed++) {
    const s=create(), random=M.createSeededRandom(`draw:${seed}`);
    while(!s.over) {
      const moves=G.legalMoves(s.board,s.turn);
      playAs(s,moves[Math.floor(random()*moves.length)].index);
    }
    if(s.winner===0)draw=s;
  }
  assert.ok(draw);
  assert.equal(G.counts(draw.board).black,G.counts(draw.board).white);
  assert.ok(G.isValid(draw));
});

test('잘못된 판·수순·무르기 기록·형식은 이어하기에서 거절', () => {
  const s=create(); G.play(s,19); G.aiMove(s,18);
  for(const bad of [null,{}, {...s,board:[]},{...s,board:s.board.map(()=>0)}, {...s,difficulty:'__proto__'},
    {...s,turn:G.WHITE}, {...s,moves:[null]}, {...s,history:[]}, {...s,lastMove:0},
    {...s,rng:1e20},{...s,elapsed:-1},{...s,daily:{}},{...s,over:true},{...s,winner:1}]) assert.equal(G.isValid(bad),false);
  const broken=copy(s); broken.history[0].board[0]=1;
  assert.equal(G.isValid(broken),false);
});

test('Worker 진입점도 같은 규칙을 읽고 요청 번호와 합법 수를 반환', () => {
  let result;
  const context=vm.createContext({ self:{postMessage:(value)=>{result=value;}} });
  context.importScripts=(...files)=>{
    assert.deepEqual(files,['../../common/core.js','logic.js']);
    for(const file of files) vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../reversi/js',file),'utf8'),context);
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../reversi/js/ai-worker.js'),'utf8'),context);
  const state=create(); state.turn=G.BLACK;
  context.self.onmessage({data:{id:42,state,options:{depth:2,nodes:1000}}});
  assert.equal(result.id,42);
  assert.ok(G.legalMoves(state.board,state.turn).some((m)=>m.index===result.move));
});

test('빈칸 6개인 종반 탐색을 완전 탐색 결과와 비교', () => {
  const score = (board,color) => { const c=G.counts(board); return color===G.BLACK?c.black-c.white:c.white-c.black; };
  function solve(board,color) {
    const moves=G.legalMoves(board,color);
    if(!moves.length) return G.legalMoves(board,3-color).length ? -solve(board,3-color) : score(board,color);
    return Math.max(...moves.map((m)=>{
      const next=board.slice(); next[m.index]=color; m.flips.forEach((i)=>{next[i]=color;});
      return -solve(next,3-color);
    }));
  }
  for(let seed=0;seed<5;seed++) {
    const s=create('hard'), random=M.createSeededRandom(`endgame:${seed}`);
    while(!s.over&&G.counts(s.board).empty>6) {
      const moves=G.legalMoves(s.board,s.turn); playAs(s,moves[Math.floor(random()*moves.length)].index);
    }
    if(s.over)continue;
    const best=solve(s.board,s.turn), index=G.chooseMove(s), next=s.board.slice();
    next[index]=s.turn; G.flips(s.board,index,s.turn).forEach((i)=>{next[i]=s.turn;});
    assert.equal(-solve(next,3-s.turn),best);
  }
});
