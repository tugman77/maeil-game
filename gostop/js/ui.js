(() => {
  'use strict';
  const G=Gostop,M=MaeilGame,ID='gostop',KEY='maeil-game.gostop.',$=id=>document.getElementById(id);
  const levels=[{key:'easy',label:'쉬움',detail:'패의 기본 가치를 살피는 컴퓨터 · 48장·7점 규칙은 같아요'},{key:'medium',label:'보통',detail:'족보 완성을 함께 살피는 컴퓨터 · 시간 제한 없음'},{key:'hard',label:'어려움',detail:'상대의 공개된 족보도 살피는 컴퓨터 · 숨은 패는 보지 않아요'}];
  let game=null,selected=null,hint=null,paused=false,finished=false,timer=0,epoch=0,picker,armed=false,armTimer=0,result=null;
  const count=x=>Number.isSafeInteger(x)&&x>=0?x:0;
  const stats=()=>{const v=M.read(KEY+'stats.v1');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};};
  function summary(){const s=stats();let wins=0,played=0;for(const k of ['easy','medium','hard','daily']){wins+=count(s[k]?.wins);played+=count(s[k]?.played);}if(played)M.setSummary(ID,`${wins}승 · ${played}판`);}
  function load(){
    const v=M.read(KEY+'game.v1');
    if(!v||v.v!==1||typeof v.id!=='string'||v.id.length>100||!levels.some(x=>x.key===v.difficulty)||!(v.daily===null||typeof v.daily==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.daily))||!Number.isSafeInteger(v.undo)||v.undo<0||!Number.isSafeInteger(v.hints)||v.hints<0)return null;
    const state=G.restore(v.state);if(!state||state.phase==='ended')return null;
    return {...v,state};
  }
  function screen(name){for(const n of ['start','game','result'])$(n+'-screen').hidden=n!==name;window.scrollTo(0,0);}
  function cancel(){epoch++;clearTimeout(timer);timer=0;}
  function save(){if(game&&!finished){const ok=M.write(KEY+'game.v1',game);$('storage-warning').hidden=ok;}}
  function startScreen(){cancel();save();screen('start');picker.refresh();const v=load();$('continue-wrap').hidden=!v;$('continue-info').textContent=v?`${v.daily?'오늘의 도전':levels.find(l=>l.key===v.difficulty).label} · ${v.state.turns[0]+v.state.turns[1]}차례 진행`:'';picker.setDaily('같은 패·같은 선 · 한 판을 마치면 완료',M.dailyDone(ID));}
  function start(v){cancel();disarm();game=v;selected=null;hint=null;paused=false;finished=false;result=null;$('pause-overlay').hidden=true;screen('game');M.markPlayed(ID);save();render();if(game.state.phase==='ended')end(game.state.result);else schedule();}
  function fresh(level='medium',daily=null){const rng=daily?M.dailyRandom(ID,daily):Math.random;return {v:1,id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,difficulty:level,daily,undo:0,hints:0,state:G.create(rng)};}
  function daily(){const date=M.todayKey(),saved=load();start(saved?.daily===date?saved:fresh('medium',date));}
  const ready=()=>game&&!finished&&!paused&&!$('game-screen').hidden&&game.state.turn===0;
  function card(id,{click,doubleClick,chosen=false,matching=false,hinted=false}={}) {
    const b=document.createElement(click?'button':'span');b.className='hwatu';if(click)b.type='button';
    b.innerHTML=GostopArt.svg(id);b.setAttribute('aria-label',G.cards[id].name);
    if(click){b.setAttribute('aria-pressed',String(chosen));b.addEventListener('click',click);if(doubleClick)b.addEventListener('dblclick',doubleClick);}
    if(chosen){const mark=document.createElement('span');mark.className='pick-label';mark.textContent='선택';b.append(mark);}
    b.classList.toggle('match',matching);b.classList.toggle('hinted',hinted);return b;
  }
  const breakdown=(name,ids)=>{const s=G.score(ids),pts=Object.entries(s.points).filter(([,n])=>n).map(([k,n])=>`${k} ${n}점`).join(' · ');return `${name}: 광 ${s.bright} · 열끗 ${s.animals} · 띠 ${s.ribbons} · 피 ${s.pi}${pts?' / '+pts:' / 아직 족보 점수 없음'}`;};
  function captured(id,ids){const out=[];for(const t of ['광','열','띠','피']){const list=ids.filter(i=>G.cards[i].type===t).sort((a,b)=>a-b);if(!list.length)continue;const label=document.createElement('p');label.className='captured-group';label.textContent=t==='열'?'열끗':t;out.push(label,...list.map(i=>card(i)));}$(id).replaceChildren(...out);}
  function undoIndex(s){let r=G.initial(s.initial.deck,s.initial.first),last=-1,turn=-1;for(let i=0;i<s.log.length;i++){if(r.turn===0&&r.phase==='play'&&r.turns[0]!==turn){last=i;turn=r.turns[0];}r=G.apply(r,s.log[i]);}return last;}
  function render(){
    if(!game)return;const s=game.state,active=ready(),play=active&&s.phase==='play',legal=G.legal(s);
    $('game-label').textContent=game.daily?`오늘의 맞고 · ${game.daily}`:`맞고 · ${levels.find(l=>l.key===game.difficulty).label}`;
    for(const [p,prefix] of [[0,'my'],[1,'cpu']]){
      const sc=G.score(s.captured[p]);$(prefix+'-score').textContent=sc.total+'점';$(prefix+'-meta').textContent=`${s.go[p]}고 · 손 ${s.hands[p].length}장`;
      $(prefix+'-breakdown').textContent=breakdown(p===0?'나':'컴퓨터',s.captured[p]);captured(prefix+'-captured',s.captured[p]);
    }
    $('stock-count').textContent=s.stock.length+'장';$('first-label').textContent=s.initial.first===0?'내가 선':'컴퓨터 선';
    const matches=selected===null?[]:s.table.filter(id=>G.cards[id].month===G.cards[selected].month);
    $('table').replaceChildren(...[...s.table].sort((a,b)=>a-b).map(id=>card(id,{matching:matches.includes(id)})));
    $('hand').replaceChildren(...[...s.hands[0]].sort((a,b)=>a-b).map(id=>card(id,{click:()=>{if(!play)return;if(selected===id){act({type:'play',id});return;}selected=id;hint=null;render();},doubleClick:()=>{if(play){selected=id;act({type:'play',id});}},chosen:selected===id,hinted:hint?.id===id})));
    $('last-draw').textContent=s.lastDraw===null?'':`직전 더미 ${G.cards[s.lastDraw].month}월 ${G.cards[s.lastDraw].type}`;
    $('game-status').textContent=paused?'일시정지 중입니다.':s.turn===1?'컴퓨터 차례입니다.':s.phase==='choose'?(s.pending.kind==='hand'?'더미를 뒤집기 전에 가져올 바닥패를 고르세요.':'뒤집은 패와 함께 가져올 바닥패를 고르세요.'):s.phase==='decision'?`${G.score(s.captured[0]).total}점! 스톱으로 마치거나 고로 계속하세요.`:'내 차례입니다. 손패를 두 번 누르거나 선택 후 내기 버튼을 누르세요.';
    $('selected-info').textContent=selected===null?(hint&&hint.type!=='play'?`추천: ${actionName(hint)}`:'같은 달이 없으면 바닥에 놓습니다.'):G.cards[selected].name+` · ${matches.length===0?'바닥에 놓기':matches.length===2?'바닥 두 장 중 하나 선택':matches.length===3?'네 장 모두 가져오기':'같은 달 맞추기'}`;
    $('play-btn').disabled=!play||selected===null;$('play-btn').textContent=selected===null?'낼 패를 골라 주세요':`${G.cards[selected].month}월 패 내기`;
    $('skip-btn').hidden=!play||!legal.some(a=>a.type==='skip');$('skip-btn').textContent=`더미만 · ${s.skips[0]}회 남음`;
    $('special-actions').replaceChildren(...legal.filter(a=>play&&['shake','bomb'].includes(a.type)).map(a=>{const b=document.createElement('button');b.type='button';b.textContent=actionName(a);b.addEventListener('click',()=>act(a));return b;}));
    const choice=active&&s.phase==='choose';$('choice-panel').hidden=!choice;
    $('choices').replaceChildren(...(choice?s.pending.choices.map(id=>card(id,{click:()=>act({type:'choose',id}),hinted:hint?.id===id})):[]));
    const decision=active&&s.phase==='decision';$('decision-panel').hidden=!decision;
    if(decision){const st=G.settlement(s,0);$('decision-title').textContent=`${G.score(s.captured[0]).total}점 · 고 또는 스톱`;$('decision-detail').textContent=`지금 스톱하면 ${st.total}점 확정${st.factors.length?' · '+st.factors.map(f=>f.name+' '+f.value+'배').join(' · '):''}`;}
    $('undo-btn').disabled=finished||paused||undoIndex(s)<0;$('hint-btn').disabled=!active;$('clear-btn').disabled=!play||selected===null;
    $('turn-notice').textContent=s.events.filter(e=>!e.startsWith('낸 패:')&&!e.startsWith('뒤집은 패:')).join(' · ');
    $('events').textContent=s.events.join(' → ')||'아직 낸 패가 없습니다.';
    $('revealed').textContent=[0,1].map(p=>`${p===0?'나':'컴퓨터'} 흔들기·폭탄: ${s.shaken[p].map(m=>m+'월').join(', ')||'없음'}`).join(' / ');
  }
  function actionName(a){return a.type==='shake'?`${a.month}월 흔들기`:a.type==='bomb'?`${a.month}월 폭탄`:a.type==='skip'?'더미만 사용':a.type==='choose'?G.cards[a.id].name:a.type==='stop'?'스톱':a.type==='go'?'고':`${G.cards[a.id].month}월 패 내기`;}
  function act(action,computer=false){
    if(!game||finished||paused||(!computer&&!ready()))return;
    const next=G.apply(game.state,action);if(!next)return;game.state=next;selected=null;hint=null;disarm();save();
    if(typeof MaeilFx!=='undefined')MaeilFx.play('stone');
    render();if(next.phase==='ended')end(next.result);else{if(next.turn===0&&next.phase==='choose')$('choices').children[0]?.focus();if(next.turn===0&&next.phase==='decision')$('stop-btn').focus();schedule();}
  }
  function schedule(){cancel();if(!game||finished||paused||$('game-screen').hidden||game.state.turn!==1)return;const token=epoch;
    timer=setTimeout(()=>{if(token!==epoch||paused||finished||$('game-screen').hidden)return;
      // 비공개 state 자체를 AI에 건네지 않는다.
      const action=GostopAI.choose(G.view(game.state,1),game.difficulty);if(action)act(action,true);
    },650);
  }
  function undo(){if(!game||finished||paused)return;const index=undoIndex(game.state);if(index<0)return;cancel();let s=G.initial(game.state.initial.deck,game.state.initial.first);for(const a of game.state.log.slice(0,index))s=G.apply(s,a);game.state=s;game.undo++;selected=null;hint=null;disarm();save();render();schedule();}
  function pause(){if(!game||finished||$('game-screen').hidden)return;paused=true;cancel();save();$('pause-overlay').hidden=false;render();$('resume-btn').focus();}
  function resume(){if(!paused)return;paused=false;$('pause-overlay').hidden=true;render();schedule();$('pause-btn').focus();}
  function disarm(){armed=false;clearTimeout(armTimer);$('resign-btn').textContent='기권';$('resign-btn').classList.remove('armed');}
  function end(r){
    if(finished)return;cancel();finished=true;result=r;M.write(KEY+'game.v1',null);
    const st=stats(),k=game.daily?'daily':game.difficulty,prev=st[k]||{},seen=Array.isArray(st.seen)?st.seen:[];
    if(!seen.includes(game.id)){
      st[k]={played:count(prev.played)+1,wins:count(prev.wins)+(r.winner===0?1:0),draws:count(prev.draws)+(r.winner===null?1:0),best:Math.max(count(prev.best),r.winner===0?r.total:0)};
      st.seen=[...seen,game.id].slice(-200);M.write(KEY+'stats.v1',st);
      if(game.daily&&r.reason!=='기권')M.recordDaily(ID,game.daily);
    }
    summary();screen('result');$('result-title').textContent=r.winner===null?'나가리 · 무승부':r.winner===0?'이겼습니다!':'컴퓨터가 이겼습니다';
    $('result-sub').textContent=r.reason;$('result-label').textContent=r.winner===null?'한 판 종료':r.winner===0?'내 확정 점수':'컴퓨터 확정 점수';$('result-score').textContent=r.total+'점';
    $('result-detail').textContent=`족보 ${r.base}점 + 고 가산 ${r.extra}점\n${r.factors.length?r.factors.map(f=>`${f.name} ${f.value}배`).join(' · '):'추가 배수 없음'}\n최종 ${r.multiplier}배`;
    $('result-record').textContent=`내 기록 ${count(st[k]?.wins)}승 · ${count(st[k]?.played)}판 · 최고 ${count(st[k]?.best)}점`;
    $('result-note').textContent=`무르기 ${game.undo}회 · 추천 ${game.hints}회${game.daily?' · '+game.daily+' 도전'+(r.reason==='기권'?' (기권은 출석 제외)':' 완료'):''}. 점수는 이 기기에만 기록됩니다.`;
  }
  M.bindSettingButtons();picker=MaeilStart.setup({id:ID,difficulties:levels,bestText:key=>{const s=stats()[key];return s?`${count(s.wins)}승 · ${count(s.played)}판 · 최고 ${count(s.best)}점`:'';},onStart:key=>start(fresh(key)),onDaily:daily});
  $('continue-btn').addEventListener('click',()=>{const v=load();if(v)start(v);else startScreen();});
  $('play-btn').addEventListener('click',()=>{if(ready()&&selected!==null)act({type:'play',id:selected});});
  $('clear-btn').addEventListener('click',()=>{selected=null;hint=null;render();});$('skip-btn').addEventListener('click',()=>act({type:'skip'}));$('stop-btn').addEventListener('click',()=>act({type:'stop'}));$('go-btn').addEventListener('click',()=>act({type:'go'}));
  $('hint-btn').addEventListener('click',()=>{if(!ready())return;hint=GostopAI.choose(G.view(game.state,0),game.difficulty);selected=hint?.type==='play'?hint.id:null;game.hints++;save();render();});
  $('undo-btn').addEventListener('click',undo);$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);$('home-btn').addEventListener('click',startScreen);
  $('resign-btn').addEventListener('click',()=>{if(!game||finished||paused)return;if(armed){end({winner:1,reason:'기권',base:0,extra:0,multiplier:1,factors:[],total:0});disarm();}else{armed=true;$('resign-btn').textContent='한 번 더 누르면 기권';$('resign-btn').classList.add('armed');armTimer=setTimeout(disarm,5000);}});
  $('again-btn').addEventListener('click',()=>game.daily?daily():start(fresh(game.difficulty)));$('result-home-btn').addEventListener('click',startScreen);
  $('share-btn').addEventListener('click',()=>{if(!result)return;M.share({title:'맞고 — 매일게임',text:`[매일게임 맞고] ${game.daily?'오늘의 도전 '+game.daily:'컴퓨터 대전'}\n${result.winner===0?'내 승리':result.winner===null?'무승부':'컴퓨터 승리'} · ${result.total}점\n무르기 ${game.undo}회 · 추천 ${game.hints}회`,url:M.pageUrl('gostop/')+(game.daily?'#daily':'')});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);window.addEventListener('pageshow',e=>{if(e.persisted)pause();});
  document.addEventListener('keydown',e=>{if(paused&&e.key==='Tab'){e.preventDefault();$('resume-btn').focus();return;}if(e.key==='Escape'&&game&&!finished&&!$('game-screen').hidden){e.preventDefault();if(paused)resume();else if(selected!==null){selected=null;hint=null;render();}else pause();}});
  startScreen();summary();MaeilStart.handleDailyLink(daily);M.registerOffline('../');
})();
