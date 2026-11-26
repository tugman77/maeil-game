/* 화면용 차례 재생. 규칙 상태와 저장 형식은 바꾸지 않는다. */
const GostopPresentation = (() => {
  const G=typeof Gostop!=='undefined'?Gostop:require('./logic');
  const speeds={normal:{move:600,reveal:1000,event:1000,think:650},slow:{move:650,reveal:1600,event:1500,think:1000},fast:{move:200,reveal:600,event:650,think:350}};
  const label=id=>`${G.cards[id].month}월 ${G.cards[id].type==='열'?'열끗':G.cards[id].pi===2?'쌍피':G.cards[id].type}`;
  function plan(before,action,after) {
    const actor=before.turn,who=actor?'컴퓨터':'나',frames=[],base=G.clone(before);
    const played=action.type==='play'?[action.id]:action.type==='bomb'?before.hands[actor].filter(id=>G.cards[id].month===action.month):[];
    const drawn=before.stock.length>after.stock.length?before.stock[0]:null;
    const gained=after.captured[actor].filter(id=>!before.captured[actor].includes(id));
    const lost=before.captured[1-actor].filter(id=>!after.captured[1-actor].includes(id));
    const events=after.events.slice(['play','bomb','skip'].includes(action.type)?0:before.events.length).filter(e=>!e.startsWith('낸 패:')&&!e.startsWith('뒤집은 패:'));
    for(const id of played){base.hands[actor]=base.hands[actor].filter(i=>i!==id);if(!base.table.includes(id))base.table.push(id);}
    const add=(kind,text,ids,state=base)=>frames.push({kind,text,ids,actor,state:G.clone(state)});
    if(played.length)add('play',`${who}: ${played.map(label).join(' · ')} 내기`,played);
    if(drawn!==null){
      add('reveal',`더미에서 ${label(drawn)}`,[drawn]);
      base.stock=[...after.stock];base.lastDraw=drawn;if(!base.table.includes(drawn))base.table.push(drawn);
      add('place',`${who}: 더미 ${label(drawn)} 바닥에`,[drawn]);
    }
    // 선택이 남았다면 획득을 미리 확정해 보이지 않는다.
    if(gained.length){
      base.captured=G.clone(before.captured);
      add('capture',`${who}: ${gained.filter(id=>!lost.includes(id)).map(label).join(' · ')} 먹음`,gained.filter(id=>!lost.includes(id)));
    }
    for(const event of events)add('event',`${who}: ${event}`,lost,after);
    if(action.type==='go'||action.type==='stop')add('speech',action.type==='go'?'고!':'스톱!',[],after);
    const summary=[];
    if(played.length)summary.push(played.map(label).join('·')+' 냄');
    if(gained.length)summary.push(gained.filter(id=>!lost.includes(id)).map(label).join('·')+' 먹음');
    if(drawn!==null)summary.push(`더미 ${label(drawn)} ${after.table.includes(drawn)?'바닥에':after.phase==='choose'?'짝 선택': '짝 맞춤'}`);
    summary.push(...events);
    if(action.type==='go'||action.type==='stop')summary.push(action.type==='go'?'고!':'스톱!');
    return {actor,frames,text:`${who}: ${summary.join(', ')||'가져올 패 선택'}`};
  }
  // 마지막으로 끝난 한 차례 전체(흔들기·선택·고 판단 포함)를 저장 로그에서 복원한다.
  function lastTurn(state) {
    let s=G.initial(state.initial.deck,state.initial.first),current=[],last=[];
    for(const action of state.log){const next=G.apply(s,action);current.push({before:s,action,after:next});if(next.turn!==s.turn||next.phase==='ended'){last=current;current=[];}s=next;}
    return last;
  }
  return {speeds,label,plan,lastTurn};
})();
if(typeof module!=='undefined')module.exports=GostopPresentation;
