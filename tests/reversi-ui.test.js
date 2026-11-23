// 실제 core/start/logic/ui를 실행한다. CSS·브라우저 렌더링은 이 검사 범위 밖이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../reversi/js/logic.js');
const M = require('../common/core.js');
const gameDom = require('./helpers/game-dom.js');
const GAME = 'maeil-game.reversi.game.v1', STATS = 'maeil-game.reversi.stats.v1';
const copy = (s) => JSON.parse(JSON.stringify(s));
const browser = (options = {}) => gameDom('reversi', { search: G.chooseMove, ...options });
const cell = (b,index) => b.element('board').children[index];
function play(b,index) { cell(b,index).fire('click'); b.click('place-btn'); }

test('시작 화면·기본 보통·64개 칸·돌 수·한 번 누르면 미리보기', () => {
  const b=browser();
  assert.equal(b.element('game-screen').hidden,true);
  b.click('start-btn');
  assert.equal(b.get(GAME).difficulty,'medium');
  assert.equal(b.element('board').children.length,64);
  assert.equal(b.element('black-count').textContent,'2');
  cell(b,19).fire('click');
  assert.equal(b.get(GAME).moves.length,0);
  assert.equal(b.element('place-btn').disabled,false);
  b.click('place-btn');
  assert.equal(b.get(GAME).moves.length,1);
  assert.equal(b.get(GAME).turn,G.WHITE);
  assert.equal(b.element('black-count').textContent,'4');
  b.advance(350); assert.equal(b.workers[0].url,'js/ai-worker.js');
  b.workers[0].reply(18);
  assert.equal(b.get(GAME).moves.length,2);
  assert.equal(b.get(GAME).turn,G.BLACK);
  assert.ok(G.isValid(b.get(GAME)));
});

test('잘못된 칸·취소·같은 칸 재선택·키보드 확인', () => {
  const b=browser(); b.click('start-btn');
  cell(b,0).fire('click'); assert.equal(b.element('place-btn').disabled,true);
  cell(b,19).fire('click'); b.click('clear-pick-btn');
  assert.equal(b.get(GAME).moves.length,0); assert.equal(b.element('place-btn').disabled,true);
  b.key('Enter',cell(b,19));
  let prevented=false;
  b.document.fire('keydown',{key:'Enter',target:cell(b,19),repeat:true,preventDefault(){prevented=true;}});
  assert.ok(prevented); assert.equal(b.get(GAME).moves.length,0);
  b.key('Enter',cell(b,19));
  assert.equal(b.get(GAME).moves[0][0],19);
  cell(b,18).fire('click'); // 컴퓨터 차례에는 추가 착수 불가
  assert.equal(b.get(GAME).moves.length,1);
});

test('추천은 돌을 놓지 않으며 사용 횟수만 저장', () => {
  const b=browser(); b.click('start-btn'); b.click('hint-btn'); b.advance(50);
  const before=b.get(GAME); b.workers[0].reply(26);
  assert.deepEqual(b.get(GAME).board,before.board);
  assert.equal(b.get(GAME).hintsUsed,1);
  assert.ok(cell(b,26).className.includes('hint'));
  assert.equal(b.element('place-btn').disabled,false);
  b.click('place-btn'); assert.equal(b.get(GAME).moves[0][0],26);
});

test('계산 중 무르기, 오래된 응답은 판을 바꾸지 않음', () => {
  const b=browser(); b.click('start-btn'); const original=b.get(GAME);
  play(b,19); b.advance(350); const old=b.workers[0];
  assert.equal(b.element('undo-btn').disabled,false);
  b.click('undo-btn'); old.reply(18);
  const restored=b.get(GAME);
  assert.deepEqual(restored.board,original.board);
  assert.equal(restored.undoUsed,1); assert.equal(restored.moves.length,0);
  assert.ok(old.terminated);
});

test('응답이 중복되거나 다른 게임으로 돌아온 뒤 도착해도 무시', () => {
  const b=browser(); b.click('start-btn'); play(b,19); b.advance(350);
  const old=b.workers[0]; old.reply(18); const after=b.get(GAME);
  old.reply(20); assert.deepEqual(b.get(GAME),after);
  const index=G.legalMoves(after.board,G.BLACK)[0].index;
  play(b,index); b.advance(350); const pending=b.workers.at(-1);
  b.click('home-btn'); b.click('start-btn'); pending.reply();
  assert.deepEqual(G.counts(b.get(GAME).board),{black:2,white:2,empty:60});
});

test('컴퓨터 차례의 저장·이어하기와 탭 전환 취소·재계산', () => {
  const b=browser(); b.click('start-btn'); play(b,19); b.advance(350);
  const old=b.workers[0], saved=b.get(GAME);
  b.document.hidden=true; b.document.fire('visibilitychange'); old.reply(18);
  assert.deepEqual(b.get(GAME),saved);
  b.document.hidden=false; b.document.fire('visibilitychange'); b.advance(350);
  b.workers.at(-1).reply(18); assert.equal(b.get(GAME).moves.length,2);
  const reopened=browser({saved:{[GAME]:saved}});
  assert.equal(reopened.element('continue-wrap').hidden,false);
  reopened.click('continue-btn'); reopened.advance(350); reopened.workers[0].reply(18);
  assert.equal(reopened.get(GAME).moves.length,2);
});

test('Worker를 쓸 수 없는 환경에서도 응수와 추천이 가능', () => {
  const b=browser({workers:false}); b.click('start-btn'); play(b,19); b.advance(400);
  assert.equal(b.get(GAME).moves.length,2);
  b.click('hint-btn'); b.advance(80);
  assert.equal(b.get(GAME).hintsUsed,1);
});

test('저장소가 막혀도 시작·착수·계산 가능', () => {
  const b=browser({blockedStorage:true,workers:false});
  b.click('start-btn'); play(b,19); b.advance(400);
  assert.equal(b.element('game-screen').hidden,false);
  assert.equal(b.element('hint-btn').disabled,false);
  assert.equal(b.get(GAME),null);
});

// 합법적인 대국 수순에서 종료 직전 상태·자동 패스 상태를 얻는다.
let fixtures;
function examples() {
  if(fixtures)return fixtures;
  fixtures={};
  for(let seed=0;seed<200&&Object.keys(fixtures).length<4;seed++) {
    const state=G.create('medium',{daily:'2026-11-23'}), random=M.createSeededRandom(`ui:${seed}`);
    while(!state.over) {
      const before=copy(state), moves=G.legalMoves(state.board,state.turn);
      const index=moves[Math.floor(random()*moves.length)].index;
      if(state.turn===G.BLACK)G.play(state,index);else G.aiMove(state,index);
      if(state.lastPassed===G.BLACK&&!state.over&&!fixtures.pass)fixtures.pass={state:before,index};
      if(state.over) {
        const key=state.winner===G.BLACK?'win':state.winner===G.WHITE?'loss':'draw';
        if(!fixtures[key])fixtures[key]={state:before,index};
      }
    }
  }
  assert.ok(fixtures.win&&fixtures.loss&&fixtures.draw&&fixtures.pass);
  return fixtures;
}

function finishExample(example) {
  const b=browser({saved:{[GAME]:example.state}});
  assert.ok(G.isValid(example.state));
  b.click('continue-btn');
  if(example.state.turn===G.BLACK)play(b,example.index);
  else {b.advance(350);b.workers[0].reply(example.index);}
  b.advance(900);
  return b;
}

test('내가 패스하면 컴퓨터가 연속으로 두고, 무르기는 내 선택 전까지 복원', () => {
  const example=examples().pass;
  const b=browser({saved:{[GAME]:example.state}});
  b.click('continue-btn'); b.advance(350); b.workers[0].reply(example.index);
  assert.equal(b.get(GAME).turn,G.WHITE);
  assert.ok(b.element('game-status').textContent.includes('컴퓨터'));
  b.advance(350); assert.equal(b.workers.length,2);
  const expected=example.state.history.at(-1);
  b.click('undo-btn');
  assert.deepEqual(b.get(GAME).board,expected.board);
  assert.equal(b.get(GAME).turn,G.BLACK);
  b.workers[1].reply(); assert.deepEqual(b.get(GAME).board,expected.board);
});

test('승·무·패 구분, 승리한 오늘의 도전만 출석 처리', () => {
  for(const key of ['win','draw','loss']) {
    const b=finishExample(examples()[key]), stats=b.get(STATS).daily;
    assert.equal(b.element('result-screen').hidden,false);
    assert.equal(stats.played,1); assert.equal(stats.wins,Number(key==='win')); assert.equal(stats.draws,Number(key==='draw'));
    assert.equal(b.get(GAME),null);
    const daily=b.get('maeil-game.daily.v1');
    assert.equal(Boolean(daily?.done['2026-11-23']?.includes('reversi')),key==='win');
    b.window.fire('pagehide'); b.advance(2000); assert.equal(b.get(STATS).daily.played,1);
  }
});

test('오늘의 도전 링크는 동일한 시작 판으로 바로 진입', () => {
  const a=browser({hash:'#daily'}), b=browser({hash:'#daily'});
  assert.equal(a.element('game-screen').hidden,false);
  assert.deepEqual(a.get(GAME),b.get(GAME));
  assert.equal(a.get(GAME).daily,'2026-11-23');
  assert.ok(G.isValid(a.get(GAME)));
});
