const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../initial-quiz/js/logic.js'),W=require('../initial-quiz/js/words.js'),M=require('../common/core.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function forQuestion(id) {
  const q=W.questions.find(q=>q.id===id),difficulty=Object.keys(G.DIFFICULTIES).find(d=>G.DIFFICULTIES[d].length===G.length(q));
  for(let i=0;i<500;i++){const s=G.create(difficulty,{random:M.createSeededRandom('test:'+i)});if(s.rounds.some(r=>r.id===id)){while(G.current(s).id!==id){G.reveal(s);G.next(s);}return s;}}
  throw Error('문제를 찾지 못함');
}
function solveByTiles(s,answer=G.question(s).answers[0]) {
  for(const letter of answer){const r=G.current(s),i=r.tiles.findIndex((c,i)=>c===letter&&!r.draft.some(x=>x.tile===i));assert.ok(i>=0);assert.ok(G.addTile(s,i));}
  assert.equal(G.submit(s),'correct');
}
test('90개 문제: 난이도별 30개·중복 ID/정답 없음·문장/초성/복수 정답 일치',()=>{
  assert.equal(W.questions.length,90);assert.equal(new Set(W.questions.map(q=>q.id)).size,90);
  assert.equal(new Set(W.questions.map(q=>q.answers[0])).size,90);
  for(const n of [2,3,4])assert.equal(W.questions.filter(q=>G.length(q)===n).length,30);
  for(const q of W.questions){assert.ok(q.category&&q.clue&&q.hint);assert.equal(new Set(q.answers.map(G.normalize)).size,q.answers.length);
    for(const a of q.answers){assert.match(a,/^[가-힣]+$/);assert.equal(a.length,G.length(q));assert.equal(G.initials(a),G.initials(q.answers[0]));assert.equal(q.clue.includes(a),false);assert.equal(q.hint.includes(a),false);}
  }
  assert.equal(G.initials('김밥'),'ㄱㅂ');assert.equal(G.initials('손톱깎이'),'ㅅㅌㄲㅇ');assert.equal(G.initials('떡볶이'),'ㄸㅂㅇ');
});
test('모든 문제와 복수 정답을 글자 버튼만으로 완성 가능',()=>{
  for(const q of W.questions)for(const answer of q.answers){const s=forQuestion(q.id);solveByTiles(s,answer);assert.ok(G.isValid(s));assert.equal(G.current(s).answer,answer);}
});
test('같은 글자 두 개는 서로 다른 조각이며 사용 중 재사용 불가',()=>{
  const s=forQuestion(W.questions.find(q=>q.answers[0]==='바나나').id),r=G.current(s),indices=r.tiles.flatMap((c,i)=>c==='나'?[i]:[]);
  assert.equal(indices.length,2);assert.ok(G.addTile(s,indices[1]));assert.equal(G.addTile(s,indices[1]),false);assert.ok(G.addTile(s,indices[0]));
  assert.equal(G.draft(s),'나나');assert.ok(G.erase(s,0));assert.equal(r.draft[0].tile,indices[0]);assert.ok(G.undo(s));assert.equal(G.draft(s),'나나');
});
test('띄어쓰기·NFC/NFD 입력, 지우기·되돌리기와 불완전 입력',()=>{
  const s=G.create('medium'),answer=G.question(s).answers[0];
  assert.equal(G.submit(s),'incomplete');assert.ok(G.setText(s,[...answer.normalize('NFD')].join('')));assert.equal(G.draft(s),answer);
  assert.ok(G.erase(s));assert.ok(G.undo(s));assert.equal(G.draft(s),answer);assert.equal(G.submit(s),'correct');
  const t=G.create('easy');assert.ok(G.setText(t,'ㄱ'));assert.equal(G.submit(t),'incomplete');assert.equal(G.setText(t,'abc'),false);
  assert.ok(G.setText(t,G.question(t).answers[0].split('').join(' ')));assert.equal(G.submit(t),'correct');
});
test('같은 오답 재확인은 기록을 늘리지 않고 힌트는 두 단계',()=>{
  const s=G.create('medium'),q=G.question(s),wrong='가'.repeat(G.length(q));assert.equal(q.answers.includes(wrong),false);
  G.setText(s,wrong);assert.equal(G.submit(s),'wrong');assert.equal(G.submit(s),'repeated');assert.equal(G.current(s).attempts.length,1);
  const before=G.draft(s);assert.ok(G.hint(s));assert.equal(G.hintText(s),q.hint);assert.ok(G.hint(s));assert.match(G.hintText(s),new RegExp(q.answers[0][0]));
  assert.equal(G.hint(s),false);assert.equal(G.draft(s),before);assert.ok(G.isValid(s));
});
test('5문제의 맞힘·정답 보기·다음 이동·최종 점수 판정',()=>{
  const s=G.create('easy');assert.equal(G.next(s),false);
  for(let i=0;i<5;i++) {if(i===2)G.reveal(s);else solveByTiles(s);assert.equal(G.submit(s),'inactive');assert.ok(G.isValid(s));assert.ok(G.next(s));}
  assert.ok(G.isDone(s));assert.equal(G.next(s),false);assert.deepEqual(G.score(s),{correct:4,revealed:1,hints:0,mistakes:0,seconds:0});assert.ok(G.isValid(s));
});
test('365일: 같은 날짜의 문제 순서와 글자 조각이 같고 난이도는 보통',()=>{
  const signatures=new Set();
  for(let i=0;i<365;i++){const day=new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),a=G.create('hard',{daily:day}),b=G.create('easy',{daily:day});
    assert.deepEqual(a,b);assert.equal(a.difficulty,'medium');assert.ok(G.isValid(a));signatures.add(a.rounds.map(r=>r.id).join(':'));
    for(let j=0;j<5;j++){solveByTiles(a);G.next(a);}assert.ok(G.isValid(a));
  }
  assert.ok(signatures.size>350);
});
test('세 난이도 150판 입력·힌트·되돌리기 후 저장 왕복',()=>{
  for(const difficulty of Object.keys(G.DIFFICULTIES))for(let i=0;i<50;i++) {
    const s=G.create(difficulty,{random:M.createSeededRandom(i+'')});G.addTile(s,0);G.hint(s);G.erase(s);G.undo(s);const restored=copy(s);
    assert.ok(G.isValid(restored));assert.deepEqual(restored,s);G.setText(restored,G.question(restored).answers[0]);assert.equal(G.submit(restored),'correct');
  }
});
test('손상된 저장·불가능한 글자/이동 상태·날짜를 거부',()=>{
  const s=G.create('medium');
  const changes=[x=>x.rounds.pop(),x=>x.rounds[0].id='missing',x=>x.rounds[0].tiles[0]='A',x=>x.rounds[0].draft=[{letter:'가',tile:999}],
    x=>x.rounds[0].hints=3,x=>x.rounds[0].status='correct',x=>x.rounds[1].status='revealed',x=>x.index=3,x=>x.elapsed=-1,x=>x.daily='2026-02-30',x=>x.bankVersion=999];
  for(const change of changes){const x=copy(s);change(x);assert.equal(G.isValid(x),false);}
  assert.equal(G.isValid(null),false);assert.throws(()=>G.create('unknown'));assert.throws(()=>G.create('toString'));assert.throws(()=>G.create('medium',{daily:'2026-02-30'}));
});
test('공유 문구에 문제·정답·초성을 포함하지 않음',()=>{
  const s=G.create('medium',{daily:'2026-11-24'});for(let i=0;i<5;i++){G.reveal(s);G.next(s);}const text=G.shareText(s);
  for(const r of s.rounds){const q=W.questions.find(q=>q.id===r.id);assert.equal(text.includes(q.answers[0]),false);assert.equal(text.includes(q.clue),false);assert.equal(text.includes(G.initials(q.answers[0])),false);}
  assert.match(text,/직접 맞힘 0\/5/);assert.match(text,/정답 보기 5문제/);
});
