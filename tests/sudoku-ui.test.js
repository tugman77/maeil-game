// 실제 입력·저장·선택 흐름을 검사한다. CSS 렌더링 검사는 별도이다.
const test=require('node:test'),assert=require('node:assert/strict');
const Game=require('../sudoku/js/game.js'),Generator=require('../sudoku/js/generator.js');
const dom=require('./helpers/game-dom.js');
const KEY='maeil-sudoku.game.v1',SETTINGS='maeil-sudoku.settings.v1';
const initial=()=>Game.create(Generator.generateDailyPuzzle('2026-11-24'));
const cell=(b,i)=>b.element('board').children[i];
const input=(b,i,value)=>{cell(b,i).fire('click');b.element('numpad').children[value-1].fire('click');};
const open=(state,settings)=>{
  const saved={[KEY]:state};if(settings)saved[SETTINGS]=settings;
  const b=dom('sudoku',{saved});b.click('continue-btn');return b;
};
test('중복 없는 오답도 표시하고 고정 칸·맞는 숫자·빈칸·메모는 제외',()=>{
  const state=initial();let i=-1,digit=0;
  for(let k=0;k<81&&i<0;k++)for(let d=1;d<=9;d++) {
    if(!state.puzzle[k]&&d!==state.solution[k]&&Game.PEERS[k].every(p=>state.values[p]!==d)){i=k;digit=d;break;}
  }
  assert.ok(i>=0);Game.setValue(state,i,digit);assert.equal(Game.conflicts(state).has(i),false);
  const good=state.puzzle.findIndex((v,k)=>!v&&k!==i);Game.setValue(state,good,state.solution[good]);
  const note=state.puzzle.findIndex((v,k)=>!v&&k!==i&&k!==good);Game.toggleNote(state,note,9);
  const before=JSON.stringify(state),bad=Game.mistakes(state);assert.deepEqual([...bad],[i]);assert.equal(JSON.stringify(state),before);
  const b=open(state);assert.equal(cell(b,i).attributes['aria-invalid'],'true');assert.match(cell(b,i).attributes['aria-label'],/오답/);
  assert.equal(cell(b,good).attributes['aria-invalid'],'false');assert.equal(cell(b,note).attributes['aria-invalid'],'false');
  assert.match(b.element('mistake-status').textContent,/오답 1칸/);
});
test('오답 찾기는 차례로 선택하며 숫자·메모·힌트·기록을 바꾸지 않음',()=>{
  const state=initial(),blank=state.puzzle.flatMap((v,i)=>v?[]:[i]).slice(0,2);
  for(const i of blank)Game.setValue(state,i,state.solution[i]%9+1);
  const b=open(state);b.click('find-mistake-btn');assert.equal(cell(b,blank[0]).attributes['aria-selected'],'true');
  b.click('find-mistake-btn');assert.equal(cell(b,blank[1]).attributes['aria-selected'],'true');
  b.click('find-mistake-btn');assert.equal(cell(b,blank[0]).attributes['aria-selected'],'true');
  assert.deepEqual(b.get(KEY),state);assert.equal(b.document.activeElement,cell(b,blank[0]));
});
test('정답 입력·지우기·되돌리기로 오답 강조와 개수도 갱신',()=>{
  const state=initial(),i=state.puzzle.indexOf(0),wrong=state.solution[i]%9+1,b=open(state);
  input(b,i,wrong);assert.equal(cell(b,i).attributes['aria-invalid'],'true');
  input(b,i,state.solution[i]);assert.equal(cell(b,i).attributes['aria-invalid'],'false');
  b.click('undo-btn');assert.equal(cell(b,i).attributes['aria-invalid'],'true');
  b.click('erase-btn');assert.equal(cell(b,i).attributes['aria-invalid'],'false');assert.match(b.element('mistake-status').textContent,/오답이 없어요/);
});
test('오류표시 끄기를 보존하고 찾기를 누를 때만 다시 켬',()=>{
  const state=initial(),i=state.puzzle.indexOf(0);Game.setValue(state,i,state.solution[i]%9+1);
  const b=open(state,{showErrors:false});assert.equal(cell(b,i).attributes['aria-invalid'],'false');assert.match(b.element('mistake-status').textContent,/꺼져/);
  b.click('find-mistake-btn');assert.equal(b.get(SETTINGS).showErrors,true);assert.equal(cell(b,i).attributes['aria-invalid'],'true');
  b.click('error-toggle');assert.equal(cell(b,i).attributes['aria-invalid'],'false');assert.equal(b.get(KEY).values[i],state.values[i]);
});
test('마지막 칸이 틀리면 해당 칸을 선택하고 고치면 정상 완료',()=>{
  const state=initial(),i=state.puzzle.indexOf(0);state.values=state.solution.slice();state.values[i]=0;
  const b=open(state);input(b,i,state.solution[i]%9+1);
  assert.equal(b.element('complete-screen').hidden,true);assert.equal(cell(b,i).attributes['aria-selected'],'true');
  assert.equal(b.get(KEY).hintsLeft,3);input(b,i,state.solution[i]);
  assert.equal(b.element('complete-screen').hidden,false);assert.equal(b.get(KEY),null);
});
test('일시정지 중 찾기는 비활성, 오답 없는 상태는 숫자를 바꾸지 않음',()=>{
  const state=initial(),b=open(state);b.click('find-mistake-btn');assert.deepEqual(b.get(KEY),state);
  b.click('pause-btn');assert.equal(b.element('find-mistake-btn').disabled,true);b.click('find-mistake-btn');
  assert.equal(b.element('pause-overlay').hidden,false);b.click('resume-btn');assert.equal(b.element('find-mistake-btn').disabled,false);
});
