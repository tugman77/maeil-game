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
test('7·8줄과 큰 글씨도 화면 폭 안에 들어가고 5:7 비율 유지',()=>{
  for(const columns of [7,8])for(const [width,height] of [[300,240],[320,568],[334,520],[374,548],[414,560],[490,230],[678,336],[944,900]])for(const large of [false,true]) {
    const l=Table.layout(width,height,columns,20,large);
    assert.ok(l.cardWidth>0);assert.ok(l.cardWidth<=96);assert.ok(l.step>=22);
    assert.ok(Math.abs(l.cardHeight/l.cardWidth-1.4)<1e-9);
    assert.equal(l.tableWidth,l.cardWidth*columns+(columns-1)*l.gap+4);
    assert.ok(l.tableWidth<=width,`${columns}줄 / ${width}px / 큰 글씨 ${large}`);
  }
  const phone=Table.layout(334,520,8,7),desktop=Table.layout(944,800,8,7);
  assert.ok(phone.cardWidth<44);assert.ok(phone.compact);assert.ok(phone.step<desktop.step);
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
    const layout=b.element('card-layout'),width=Number.parseInt(layout.style['--card-width']);assert.ok(width>0);assert.ok(Number.parseInt(layout.style['--table-width'])<=540);
    b.document.querySelectorAll('.large-text-toggle')[0].fire('click');assert.ok(Number.parseInt(layout.style['--table-width'])<=540);
    b.document.querySelectorAll('.dark-toggle')[0].fire('click');
    assert.deepEqual(b.get(key),before);assert.equal(b.element('selection-info').textContent,selection);
    assert.equal(layout.style['--table-columns'],game==='freecell'?'8':'7');
  }
});

test('휴대폰 세로·가로 회전과 큰 글씨 모두 좌우 이동 없이 모든 줄 유지',()=>{
  for(const game of games) {
    const b=browser(game),key=`maeil-game.${game}.game.v1`;b.click('start-btn');b.click('hint-btn');
    const before=b.get(key),selection=b.element('selection-info').textContent;
    for(const [width,height,viewWidth,viewHeight] of [[360,800,334,520],[390,844,364,564],[667,320,508,260],[844,390,685,330],[360,800,334,520]]) {
      b.window.innerWidth=width;b.window.innerHeight=height;
      b.element('tableau-viewport').clientWidth=viewWidth;b.element('tableau-viewport').clientHeight=viewHeight;
      b.window.fire('resize');const surface=b.element('card-layout');
      assert.ok(Number.parseInt(surface.style['--table-width'])<=viewWidth);
      assert.equal(b.element('tableau').children.length,game==='freecell'?8:7);
      b.document.querySelectorAll('.large-text-toggle')[0].fire('click');
      assert.ok(Number.parseInt(surface.style['--table-width'])<=viewWidth);
      assert.deepEqual(b.get(key),before);assert.equal(b.element('selection-info').textContent,selection);
    }
  }
});
