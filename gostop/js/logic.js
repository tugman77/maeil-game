/* 매일게임 맞고 — 원본 규칙 엔진. 규칙 계약: ../RULES.md */
const Gostop = (() => {
  const M = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const flowers = ['소나무','매화','벚꽃','등나무','난초','모란','싸리','억새','국화','단풍','오동','비'];
  const types = ['광 띠 피 피','열 띠 피 피','광 띠 피 피','열 띠 피 피','열 띠 피 피','열 띠 피 피','열 띠 피 피','광 열 피 피','열 띠 피 피','열 띠 피 피','광 피 피 피','광 열 띠 피'];
  const motifs = {0:'학',4:'꾀꼬리',8:'장막',12:'두견새',16:'다리',20:'나비',24:'멧돼지',28:'달',29:'기러기',32:'술잔',36:'사슴',40:'봉황',44:'우산',45:'제비'};
  const cards = types.flatMap((s,m) => s.split(' ').map((type,k) => {
    const id=m*4+k, pi=type==='피' ? ([41,47].includes(id)?2:1) : 0;
    const set=type==='띠' ? ([0,1,2].includes(m)?'홍단':[5,8,9].includes(m)?'청단':[3,4,6].includes(m)?'초단':'비띠') : '';
    return {id,month:m+1,type,pi,set,flower:flowers[m],motif:motifs[id]||'',name:`${m+1}월 ${flowers[m]} · ${motifs[id]||set||(pi===2?'쌍피':type)}`};
  }));
  const clone = x => JSON.parse(JSON.stringify(x));
  const month = id => cards[id].month;
  const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
  const byMonth = (list,m) => list.filter(id=>month(id)===m);
  const remove = (list,ids) => ids.forEach(id=>{const i=list.indexOf(id);if(i<0)throw Error('없는 패');list.splice(i,1);});
  function score(ids) {
    const count=t=>ids.filter(id=>cards[id].type===t).length;
    const bright=count('광'), animals=count('열'), ribbons=count('띠'), pi=ids.reduce((n,id)=>n+cards[id].pi,0);
    const light=bright===5?15:bright===4?4:bright===3?(ids.includes(44)?2:3):0;
    const godori=[4,12,29].every(id=>ids.includes(id))?5:0;
    const sets=['홍단','청단','초단'].filter(set=>ids.filter(id=>cards[id].set===set).length===3);
    const points={광:light,열끗:Math.max(0,animals-4),고도리:godori,띠:Math.max(0,ribbons-4),피:Math.max(0,pi-9)};
    sets.forEach(set=>points[set]=3);
    return {bright,animals,ribbons,pi,points,total:Object.values(points).reduce((a,b)=>a+b,0)};
  }
  function settlement(s,w) {
    const a=score(s.captured[w]),b=score(s.captured[1-w]),go=s.go[w];
    const factors=[];
    if(go>=3)factors.push({name:`${go}고`,value:2**(go-2)});
    s.shaken[w].forEach(m=>factors.push({name:`${m}월 흔들기·폭탄`,value:2}));
    if(a.pi>=10&&b.pi>=1&&b.pi<=7)factors.push({name:'피박',value:2});
    if(a.points.광>0&&b.bright===0)factors.push({name:'광박',value:2});
    if(a.animals>=7)factors.push({name:'멍따',value:2});
    if(s.go[1-w]>0)factors.push({name:'고박',value:2});
    const extra=Math.min(go,2),multiplier=factors.reduce((n,f)=>n*f.value,1);
    return {base:a.total,extra,multiplier,factors,total:(a.total+extra)*multiplier};
  }
  function win(s,w,reason,fixed) {
    s.phase='ended';s.pending=null;
    s.result={winner:w,reason,...(fixed!==undefined?{base:fixed,extra:0,multiplier:1,factors:[],total:fixed}:settlement(s,w))};
  }
  function initial(deck,first=0) {
    if(!Array.isArray(deck)||deck.length!==48||new Set(deck).size!==48||deck.some(id=>!Number.isInteger(id)||id<0||id>47)||![0,1].includes(first))throw Error('잘못된 배치');
    const s={v:1,initial:{deck:[...deck],first},hands:[deck.slice(0,10),deck.slice(10,20)],table:deck.slice(20,28),stock:deck.slice(28),captured:[[],[]],turn:first,phase:'play',pending:null,tx:null,go:[0,0],lastGo:[0,0],shaken:[[],[]],revealed:[[],[]],skips:[0,0],ppuk:{},ppukCount:[0,0],turns:[0,0],events:[],lastDraw:null,result:null,log:[]};
    if(Array.from({length:12},(_,i)=>i+1).some(m=>byMonth(s.table,m).length===4))throw Error('바닥 총통 재분배');
    const quads=s.hands.map(h=>Array.from({length:12},(_,i)=>i+1).some(m=>byMonth(h,m).length===4));
    if(quads[0]&&quads[1])win(s,null,'양쪽 총통',0);else if(quads.some(Boolean))win(s,quads[0]?0:1,'총통',7);
    return s;
  }
  function create(random=Math.random) {
    for(let n=0;n<1000;n++) {
      const deck=M.shuffle(Array.from({length:48},(_,i)=>i),random),first=random()<0.5?0:1;
      try{return initial(deck,first);}catch(e){if(e.message!=='바닥 총통 재분배')throw e;}
    }
    throw Error('배치 실패');
  }
  function legal(s) {
    if(s.phase==='ended')return [];
    if(s.phase==='choose')return s.pending.choices.map(id=>({type:'choose',id}));
    if(s.phase==='decision')return [{type:'stop'},...(slots(s,s.turn)>0?[{type:'go'}]:[])];
    const p=s.turn,h=s.hands[p],out=h.map(id=>({type:'play',id}));
    if(s.skips[p]>0)out.push({type:'skip'});
    for(let m=1;m<=12;m++)if(byMonth(h,m).length===3&&!s.shaken[p].includes(m)) {
      out.push({type:'shake',month:m});
      if(byMonth(s.table,m).length===1)out.push({type:'bomb',month:m});
    }
    return out;
  }
  function slots(s,p){return s.hands[p].length+s.skips[p];}
  function event(s,text){s.events.push(text);}
  function steal(s,units) {
    const from=s.captured[1-s.turn],to=s.captured[s.turn];let received=0;
    while(units>0) {
      const id=[...from].filter(id=>cards[id].pi).sort((a,b)=>cards[a].pi-cards[b].pi||a-b)[0];
      if(id===undefined)break;
      remove(from,[id]);to.push(id);units-=cards[id].pi;received+=cards[id].pi;
    }
    if(received)event(s,`상대 피 ${received}장 가치 받기`);
  }
  function takeTriple(s,m) {
    const owner=s.ppuk[m];
    // 처음 깔린 세 장도 한 묶음으로 취급하며 피 1장 받기.
    const units=owner===s.turn?2:1;s.tx.steal+=units;
    event(s,owner===s.turn?'자뻑 가져오기':'세 장 묶음 가져오기');delete s.ppuk[m];
  }
  function finish(s) {
    const p=s.turn,t=s.tx;
    s.captured[p].push(...t.capture);
    const last=slots(s,0)+slots(s,1)===0;
    if(!last&&s.table.length===0){t.steal++;event(s,'쓸 · 바닥 비움');}
    if(t.steal)steal(s,t.steal);
    s.turns[p]++;s.tx=null;s.pending=null;
    if(s.ppukCount[p]>=3){win(s,p,'3뻑',7);return;}
    const total=score(s.captured[p]).total;
    if(total>=7&&(s.go[p]===0||total>s.lastGo[p])) {
      if(slots(s,p)===0){win(s,p,'마지막 차례 스톱');return;}
      s.phase='decision';return;
    }
    if(last){win(s,null,'나가리',0);return;}
    s.turn=1-p;s.phase='play';
  }
  function draw(s) {
    const t=s.tx,p=s.turn,id=s.stock.shift();
    if(id===undefined)throw Error('더미가 부족합니다');
    t.draw=id;s.lastDraw=id;event(s,`뒤집은 패: ${cards[id].name}`);
    const m=month(id),last=slots(s,0)+slots(s,1)===0;
    if(t.played!==null&&month(t.played)===m&&!t.bomb) {
      if(t.matches.length===0){remove(s.table,[t.played]);t.capture.push(t.played,id);if(!last){t.steal++;event(s,'쪽');}finish(s);return;}
      if(t.matches.length===1){s.table.push(t.played,...t.matches,id);s.ppuk[m]=p;s.ppukCount[p]++;event(s,'뻑 · 세 장을 바닥에 남김');finish(s);return;}
      if(t.matches.length===2){const rest=byMonth(s.table,m);remove(s.table,rest);t.capture.push(t.played,...t.taken,...rest,id);if(!last){t.steal++;event(s,'따닥');}finish(s);return;}
    }
    if(t.played!==null&&t.matches.length>0&&!t.bomb)t.capture.push(t.played,...t.taken);
    const matches=byMonth(s.table,m);
    if(matches.length===2){s.phase='choose';s.pending={kind:'draw',choices:matches};return;}
    captureDraw(s,matches[0]);
  }
  function captureDraw(s,target) {
    const id=s.tx.draw,m=month(id),matches=byMonth(s.table,m);
    if(matches.length===0)s.table.push(id);
    else {
      const taken=matches.length===3?matches:[target];remove(s.table,taken);s.tx.capture.push(id,...taken);
      if(matches.length===3)takeTriple(s,m);
    }
    finish(s);
  }
  function handChoice(s,target) {
    const t=s.tx,m=month(t.played);
    const taken=t.matches.length===3?[...t.matches]:[target];
    remove(s.table,taken);t.taken=taken;
    if(t.matches.length===3)takeTriple(s,m);
    draw(s);
  }
  function step(s,a) {
    const p=s.turn;
    if(a.type==='stop'){win(s,p,'스톱');return;}
    if(a.type==='go'){s.go[p]++;s.lastGo[p]=score(s.captured[p]).total;event(s,`${s.go[p]}고`);s.phase='play';s.turn=1-p;return;}
    if(a.type==='shake') {
      s.shaken[p].push(a.month);s.revealed[p].push(...byMonth(s.hands[p],a.month));event(s,`${a.month}월 흔들기 · 세 장 공개`);return;
    }
    if(a.type==='choose') {
      const kind=s.pending.kind;s.pending=null;s.phase='play';
      if(kind==='hand')handChoice(s,a.id);else captureDraw(s,a.id);
      return;
    }
    s.events=[];s.lastDraw=null;
    s.tx={played:null,matches:[],taken:[],capture:[],steal:0,bomb:false,draw:null};
    if(a.type==='skip'){s.skips[p]--;event(s,'폭탄 뒤 더미만 사용');draw(s);return;}
    if(a.type==='bomb') {
      const ids=byMonth(s.hands[p],a.month),ground=byMonth(s.table,a.month);
      remove(s.hands[p],ids);remove(s.table,ground);s.tx.capture.push(...ids,...ground);s.tx.bomb=true;
      s.skips[p]+=2;s.shaken[p].push(a.month);s.tx.steal++;event(s,`${a.month}월 폭탄 · 남은 더미만 ${s.skips[p]}회`);draw(s);return;
    }
    remove(s.hands[p],[a.id]);s.tx.played=a.id;event(s,`낸 패: ${cards[a.id].name}`);
    const matches=byMonth(s.table,month(a.id));s.tx.matches=[...matches];
    if(matches.length===0){s.table.push(a.id);draw(s);}
    else if(matches.length===2){s.phase='choose';s.pending={kind:'hand',choices:matches};}
    else handChoice(s,matches[0]);
  }
  function apply(state,action) {
    if(!legal(state).some(a=>same(a,action)))return null;
    const s=clone(state);step(s,action);s.log.push(clone(action));return s;
  }
  // 초기 배치와 합법 행동을 재생한 결과만 저장으로 인정한다.
  function restore(value) {
    try {
      if(!value||value.v!==1||!Array.isArray(value.log)||value.log.length>300)return null;
      let s=initial(value.initial.deck,value.initial.first);
      for(const action of value.log){s=apply(s,action);if(!s)return null;}
      return same(s,value)?s:null;
    }catch{return null;}
  }
  function view(s,p=s.turn) {
    // AI·추천에는 이 객체만 전달한다. 비공개 정보는 포함하지 않는다.
    return {player:p,turn:s.turn,phase:s.phase,hand:[...s.hands[p]],opponentCount:s.hands[1-p].length,table:[...s.table],captured:clone(s.captured),stockCount:s.stock.length,go:[...s.go],shaken:clone(s.shaken),revealed:s.revealed.map((ids,i)=>ids.filter(id=>s.hands[i].includes(id))),skips:[...s.skips],pending:clone(s.pending),publicTurn:s.tx?{played:s.tx.played,draw:s.tx.draw,capture:[...s.tx.capture]}:null,actions:legal(s)};
  }
  return {cards,flowers,clone,score,settlement,initial,create,legal,apply,restore,view};
})();
if(typeof module!=='undefined')module.exports=Gostop;
