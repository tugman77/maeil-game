// 카드 표시·치수 계산·상태 보존 검사. 실제 CSS 렌더링은 별도 검수한다.
const test=require('node:test'),assert=require('node:assert/strict');
const Table=require('../common/card-table.js'),dom=require('./helpers/game-dom.js');
const games=['freecell','klondike'];
const browser=(game,options={})=>dom(game,{scripts:['common/card-table.js',`${game}/js/deals.js`],...options});
const child=(el,name)=>el.children.find(c=>c.classList.contains(name));
function assertFace(el,rank,suit) {
  assert.ok(el.classList.contains('playing-card'));
  const top=child(el,'card-corner'),bottom=child(el,'card-corner-bottom');
  assert.equal(child(top,'card-rank').textContent,rank);assert.equal(child(bottom,'card-rank').textContent,rank);
  assert.equal(child(top,'card-suit').textContent,suit+'\uFE0E');assert.equal(child(bottom,'card-suit').textContent,suit+'\uFE0E');
  assert.equal(child(el,'card-mark').textContent,suit+'\uFE0E');
  assert.equal(top.attributes['aria-hidden'],'true');assert.equal(bottom.attributes['aria-hidden'],'true');
}
test('7·8줄과 작은 가로·세로·큰 화면에서 5:7 비율과 최소 터치 크기 유지',()=>{
  for(const columns of [7,8])for(const [width,height] of [[320,568],[374,844],[490,320],[678,390],[944,900]])for(const large of [false,true]) {
    const l=Table.layout(width,height,columns,20,large);
    assert.ok(l.cardWidth>=(large?64:56));assert.ok(l.cardWidth<=96);assert.ok(l.step>=44);
    assert.ok(Math.abs(l.cardHeight/l.cardWidth-1.4)<1e-9);
    assert.equal(l.tableWidth,l.cardWidth*columns+(columns-1)*6+12);
    if(width>=columns*(large?64:56)+(columns-1)*6+12)assert.ok(l.tableWidth<=width);
  }
});
test('두 게임 카드와 채워진 완성 칸에 같은 양쪽 숫자·무늬 표시',()=>{
  for(const game of games) {
    const G=require(`../${game}/js/logic.js`),state=G.create('medium',{dealNumber:19});
    for(const action of state.solution) {
      if(state.foundations.some(Boolean))break;
      if(action.type==='draw')G.draw(state);else G.move(state,action.from,action.to);
    }
    const key=`maeil-game.${game}.game.v1`,b=browser(game,{saved:{[key]:state}});b.click('continue-btn');
    const index=state.foundations.findIndex(Boolean),card=index*13+state.foundations[index]-1;
    assertFace(b.element('foundations').children[index],G.rankText(card),G.SUITS[index]);
    const col=state.columns.findIndex(c=>c.length),last=state.columns[col].at(-1);
    assertFace(b.element('tableau').children[col].children.at(-1),G.rankText(last),G.SUITS[G.suit(last)]);
    assert.deepEqual(b.get(key),state);
  }
});
test('덱 뒷면·아래 장수와 뽑은 카드, 덱 소진·재순환 모양',()=>{
  const b=browser('klondike');b.click('start-btn');
  assert.ok(b.element('draw-btn').classList.contains('card-back'));assert.match(b.element('stock-info').textContent,/24장/);
  for(const el of b.element('foundations').children) {assert.ok(el.classList.contains('empty-card'));assert.equal(child(el,'slot-caption').textContent,'A부터');}
  b.click('draw-btn');const G=require('../klondike/js/logic.js'),card=b.get('maeil-game.klondike.game.v1').waste.at(-1);
  assertFace(b.element('waste-slot').children[0],G.rankText(card),G.SUITS[G.suit(card)]);
  for(let i=1;i<24;i++)b.click('draw-btn');
  assert.equal(b.element('draw-btn').classList.contains('card-back'),false);assert.match(b.element('draw-btn').attributes['aria-label'],/다시 돌리기/);
  b.click('draw-btn');assert.ok(b.element('draw-btn').classList.contains('card-back'));assert.match(b.element('stock-info').textContent,/24장/);
});
test('창 크기·큰 글씨·테마를 바꿔도 선택과 저장 판은 유지',()=>{
  for(const game of games) {
    const b=browser(game),key=`maeil-game.${game}.game.v1`;b.click('start-btn');b.click('hint-btn');
    const before=b.get(key),selection=b.element('selection-info').textContent;
    b.element('tableau-viewport').clientWidth=540;b.window.fire('resize');
    const layout=b.element('card-layout'),width=Number.parseInt(layout.style['--card-width']);assert.ok(width>=56);
    b.document.querySelectorAll('.large-text-toggle')[0].fire('click');assert.ok(Number.parseInt(layout.style['--card-width'])>=64);
    b.document.querySelectorAll('.dark-toggle')[0].fire('click');
    assert.deepEqual(b.get(key),before);assert.equal(b.element('selection-info').textContent,selection);
    assert.equal(layout.style['--table-columns'],game==='freecell'?'8':'7');
  }
});
