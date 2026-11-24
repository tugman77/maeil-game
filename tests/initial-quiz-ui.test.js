// 실제 core/start/문제은행/규칙/화면 흐름. CSS·실제 휴대폰 화면 검수는 별도이다.
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../initial-quiz/js/logic.js'),W=require('../initial-quiz/js/words.js'),dom=require('./helpers/game-dom.js');
const GAME='maeil-game.initial-quiz.game.v1',STATS='maeil-game.initial-quiz.stats.v1',DAILY='maeil-game.initial-quiz.daily.v1';
const browser=(options={})=>dom('initial-quiz',{scripts:['initial-quiz/js/words.js'],...options});
function answerByTiles(b,answer) {
  answer=answer||G.question(b.get(GAME)).answers[0];
  for(const letter of answer){const r=G.current(b.get(GAME)),i=r.tiles.findIndex((c,i)=>c===letter&&!r.draft.some(x=>x.tile===i));assert.ok(i>=0);b.element('tile-bank').children[i].fire('click');}
  b.click('submit-btn');
}
function lastRound(day=null) {const s=G.create('medium',{daily:day});for(let i=0;i<4;i++){G.reveal(s);G.next(s);}return s;}
test('보통 시작·5문제·초성·뜻·큰 글자 버튼과 세 난이도',()=>{
  const b=browser();b.click('start-btn');const s=b.get(GAME),q=G.question(s);assert.ok(G.isValid(s));assert.equal(s.difficulty,'medium');
  assert.equal(b.element('question-number').textContent,'1/5');assert.equal(b.element('initials').textContent,G.initials(q.answers[0]));
  assert.equal(b.element('question-text').textContent,q.clue);assert.equal(b.element('answer-slots').children.length,3);assert.ok(b.element('tile-bank').children.length>=7);
  assert.equal(b.element('keyboard-mode').open,false);assert.equal(b.element('submit-btn').disabled,true);assert.equal(b.element('answer-panel').hidden,true);
});
test('글자 버튼으로 맞히기·정답 확인·다음 문제, 두 번 누름 중복 방지',()=>{
  const b=browser();b.click('start-btn');answerByTiles(b);assert.equal(G.current(b.get(GAME)).status,'correct');assert.equal(b.element('answer-panel').hidden,false);
  assert.equal(b.element('correct-count').textContent,'1');const before=b.get(GAME);b.click('submit-btn');assert.deepEqual(b.get(GAME),before);
  b.click('next-btn');assert.equal(b.get(GAME).index,1);b.click('next-btn');assert.equal(b.get(GAME).index,1);
  assert.equal(b.element('answer-slots').children.every(x=>x.textContent==='·'),true);
});
test('한 글자 지우기·슬롯 지우기·되돌리기는 입력만 복원',()=>{
  const b=browser();b.click('start-btn');b.element('tile-bank').children[0].fire('click');const s=b.get(GAME);
  b.click('erase-btn');assert.equal(G.draft(b.get(GAME)),'');b.click('undo-btn');assert.deepEqual(G.current(b.get(GAME)).draft,G.current(s).draft);
  b.element('answer-slots').children[0].fire('click');assert.equal(G.draft(b.get(GAME)),'');b.click('undo-btn');assert.equal(G.draft(b.get(GAME)),G.draft(s));
});
test('오답 재확인·두 단계 힌트·입력 유지',()=>{
  const b=browser();b.click('start-btn');const input=b.element('keyboard-answer');input.value='가가가';input.fire('input');b.click('submit-btn');b.click('submit-btn');
  assert.equal(G.current(b.get(GAME)).attempts.length,1);b.click('hint-btn');b.click('hint-btn');b.click('hint-btn');
  assert.equal(G.current(b.get(GAME)).hints,2);assert.equal(G.draft(b.get(GAME)),'가가가');assert.equal(b.element('hint-btn').disabled,true);
});
test('정답 보기는 두 번 확인하며 편집·시간 경과 시 확인 취소',()=>{
  const b=browser();b.click('start-btn');b.click('reveal-btn');assert.equal(G.current(b.get(GAME)).status,'playing');b.advance(5100);assert.equal(b.element('reveal-btn').textContent,'정답 보기');
  b.click('reveal-btn');b.element('tile-bank').children[0].fire('click');assert.equal(b.element('reveal-btn').textContent,'정답 보기');
  b.click('reveal-btn');b.click('reveal-btn');assert.equal(G.current(b.get(GAME)).status,'revealed');assert.equal(b.element('correct-count').textContent,'0');assert.equal(b.element('answer-panel').hidden,false);
});
test('한글 조합 중 Enter는 제출하지 않으며 조합 완료 뒤 제출',()=>{
  const b=browser();b.click('start-btn');const input=b.element('keyboard-answer'),answer=G.question(b.get(GAME)).answers[0];
  input.fire('compositionstart');input.value=answer;input.fire('input',{isComposing:true});b.document.fire('keydown',{key:'Enter',target:input,isComposing:true,keyCode:229});
  assert.equal(G.draft(b.get(GAME)),'');assert.equal(G.current(b.get(GAME)).status,'playing');input.fire('compositionend');
  assert.equal(G.draft(b.get(GAME)),answer);b.document.fire('keydown',{key:'Enter',target:input,repeat:false});assert.equal(G.current(b.get(GAME)).status,'correct');
});
test('잘못된 키보드 입력이 이전 답을 몰래 제출하지 않음',()=>{
  const b=browser();b.click('start-btn');const input=b.element('keyboard-answer'),answer=G.question(b.get(GAME)).answers[0];
  input.value=answer;input.fire('input');input.value='abc';input.fire('input');b.click('submit-btn');assert.equal(G.current(b.get(GAME)).status,'playing');
  input.value=answer.split('').join(' ');input.fire('input');b.click('submit-btn');assert.equal(G.current(b.get(GAME)).status,'correct');
});
test('일시정지·탭 숨김·bfcache·저장 이어하기에 문제와 입력 보존',()=>{
  const b=browser();b.click('start-btn');b.element('tile-bank').children[0].fire('click');b.advance(1200);b.click('pause-btn');const s=b.get(GAME);
  assert.ok(s.elapsed>=1);b.advance(5000);b.click('hint-btn');assert.deepEqual(b.get(GAME),s);b.click('resume-btn');
  b.document.hidden=true;b.document.fire('visibilitychange');assert.equal(b.element('pause-overlay').hidden,false);
  const c=browser({saved:{[GAME]:b.get(GAME)}});c.click('continue-btn');assert.deepEqual(c.get(GAME),b.get(GAME));
  c.window.fire('pagehide');c.window.fire('pageshow',{persisted:true});assert.equal(c.element('pause-overlay').hidden,false);
});
test('같은 날짜 같은 문제·글자, 5문제 완료 시 출석·기록·한 번 집계',()=>{
  const a=browser({hash:'#daily'}),b=browser({hash:'#daily'});assert.deepEqual(a.get(GAME),b.get(GAME));const initial=a.get(GAME);
  for(let i=0;i<5;i++){answerByTiles(a);a.click('next-btn');}
  assert.equal(a.element('result-screen').hidden,false);assert.equal(a.get(GAME),null);assert.equal(a.get(STATS).daily.played,1);assert.equal(a.get(STATS).daily.best.correct,5);
  assert.ok(a.get('maeil-game.daily.v1').done['2026-11-23'].includes('initial-quiz'));a.click('next-btn');a.window.fire('pagehide');assert.equal(a.get(STATS).daily.played,1);
  a.click('again-btn');assert.deepEqual(a.get(GAME).rounds,initial.rounds);
});
test('지난 날짜 이어하기 완료가 새 날짜 최고 기록을 덮어쓰지 않음',()=>{
  const state=lastRound('2026-11-22'),latest={date:'2026-11-23',correct:5,revealed:0,hints:0,mistakes:0,seconds:100};
  const b=browser({saved:{[GAME]:state,[DAILY]:latest}});b.click('continue-btn');answerByTiles(b);b.click('next-btn');assert.deepEqual(b.get(DAILY),latest);
});
test('손상 저장은 무시하고 저장소가 차단돼도 끝까지 진행',()=>{
  const bad=browser({saved:{[GAME]:{rounds:[]},[STATS]:'손상'}});assert.equal(bad.element('continue-wrap').hidden,true);bad.click('start-btn');assert.ok(G.isValid(bad.get(GAME)));
  const b=browser({blockedStorage:true});b.click('start-btn');for(let i=0;i<5;i++){b.click('reveal-btn');b.click('reveal-btn');b.click('next-btn');}
  assert.equal(b.element('result-screen').hidden,false);assert.equal(b.element('result-score').textContent,'0/5');
});
