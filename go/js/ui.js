(() => {
  'use strict';
  const M=MaeilGame,G=GoGame,AI=GoAI,ID='go',$=id=>document.getElementById(id);
  const KEY={game:'maeil-game.go.game.v1',stats:'maeil-game.go.stats.v1',daily:'maeil-game.go.daily.v1'};
  let game=null,picker,selected=-1,hinted=-1,cursor=40,points=[],paused=false,finished=false,thinking=false,worker=null,requestId=0,computeTimer=0,watchdog=0;
  let clock=0,lastTick=0,ticks=0,armed='',armTimer=0,zoomed=false;
  const label=s=>s.daily?`${M.dateLabel(s.daily)} 한 수 돌 잡기`:G.DIFFICULTIES[s.difficulty].label;
  const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  const loadStats=()=>{const s=M.read(KEY.stats);return s&&typeof s==='object'&&!Array.isArray(s)?s:{};};
  const loadGame=()=>{const s=M.read(KEY.game);return G.isValid(s)&&!s.over?s:null;};
  const save=()=>{if(game&&!game.over&&!finished)M.write(KEY.game,game);};
  const clearSave=()=>{try{localStorage.removeItem(KEY.game);}catch{}};
  function summary(){const total=Object.values(loadStats()).reduce((a,s)=>({played:a.played+count(s?.played),wins:a.wins+count(s?.wins)}),{played:0,wins:0});if(total.played)M.setSummary(ID,`${total.wins}승 · ${total.played}판`);}
  function screen(id){['start-screen','game-screen','result-screen'].forEach(k=>{$(k).hidden=k!==id;});window.scrollTo(0,0);}
  function cancelSearch(){requestId++;clearTimeout(computeTimer);clearTimeout(watchdog);worker?.terminate();worker=null;thinking=false;}
  function disarm(){armed='';clearTimeout(armTimer);$('resign-btn').textContent='기권';}
  function renderStart(){
    cancelSearch();stopClock();disarm();const day=M.todayKey(),done=M.dailyDone(ID,day),saved=loadGame();
    picker.setDaily(`${M.dateLabel(day)} · ${done?'완료 · 표시된 백돌을 잡았어요':'같은 문제 · 표시된 백돌을 한 수로 잡기'}`,done);
    $('continue-wrap').hidden=!saved;$('start-screen').classList.toggle('has-continue',Boolean(saved));
    if(saved)$('continue-info').textContent=`${label(saved)} · ${saved.phase==='scoring'?'계가 확인 중':saved.kind==='puzzle'?'시도 '+saved.attempts+'회':saved.ply+'수 진행'}`;
    picker.refresh();screen('start-screen');
  }
  function buildBoard(){points=Array.from({length:81},(_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','gridcell');b.addEventListener('click',()=>pick(i));return b;});$('board').replaceChildren(...points);}
  function ready(){return game&&!paused&&!thinking&&!finished&&!game.over&&game.phase==='play'&&game.turn===G.BLACK&&!game.attempted;}
  function render(){
    if(!game)return;const scoring=game.phase==='scoring',area=scoring?G.score(game.board,game.dead):null,dead=new Set(game.dead);
    points.forEach((b,i)=>{
      const v=game.board[i],classes=['go-cell'];if(v)classes.push(v===G.BLACK?'black':'white');
      if(!v&&selected===i)classes.push('preview');if(hinted===i)classes.push('hinted');if(i===game.last)classes.push('last');
      if(game.kind==='puzzle'&&game.targets.includes(i)&&v)classes.push('target');if(dead.has(i))classes.push('dead');
      if(scoring&&!v&&area.ownership[i])classes.push(area.ownership[i]===G.BLACK?'territory-black':'territory-white');
      b.className=classes.join(' ');b.disabled=Boolean(paused||thinking||finished||game.over||(!scoring&&(game.turn!==G.BLACK||game.attempted)));
      b.tabIndex=i===cursor?0:-1;b.setAttribute('aria-selected',String(i===selected));
      b.setAttribute('aria-label',`${G.coord(i)}, ${v===G.BLACK?'내 흑돌':v===G.WHITE?'컴퓨터 백돌':'빈 점'}${i===selected?', 두기 전 미리보기':''}${dead.has(i)?', 죽은 돌로 제외':''}${game.kind==='puzzle'&&game.targets.includes(i)?', 잡을 목표':''}${game.last===i?', 마지막 수':''}`);
      if(v||selected===i&&!scoring){const stone=document.createElement('span');stone.className='stone';stone.setAttribute('aria-hidden','true');b.replaceChildren(stone);}else b.replaceChildren();
    });
    $('play-area').inert=paused;$('home-btn').disabled=paused;$('pause-btn').disabled=paused;
    $('black-captures').textContent=game.captures.black;$('white-captures').textContent=game.captures.white;
    $('place-btn').hidden=scoring;$('place-btn').disabled=!ready()||selected<0;
    $('place-btn').textContent=selected<0?'점을 골라 주세요':`${G.coord(selected)} · 여기에 두기`;
    $('undo-btn').disabled=paused||finished||!G.canUndo(game);$('hint-btn').disabled=!ready();$('pass-btn').disabled=!ready()||game.kind==='puzzle';
    $('clear-pick-btn').disabled=paused||thinking||selected<0;$('resign-btn').disabled=paused||finished||game.kind==='puzzle'||game.over;
    $('zoom-btn').setAttribute('aria-pressed',String(zoomed));$('board-scroll').classList.toggle('zoomed',zoomed);$('scoring-panel').hidden=!scoring;
    if(scoring)$('score-preview').textContent=`흑 ${area.black}점 : 백 ${area.white}점 (덤 6.5 포함) · ${area.winner===G.BLACK?'흑':'백'} ${area.margin}점 우세 · 제외 ${game.dead.length}개`;
    $('game-label').textContent=`${label(game)} · 9줄 · 나는 흑으로 둡니다`;
    $('game-status').textContent=paused?'일시정지 중':thinking?(thinking==='hint'?'추천할 수를 찾고 있어요…':'컴퓨터가 생각하고 있어요…')
      :scoring?'계가 확인 · 죽은 돌 무리를 눌러 제외하거나 계속 두세요.'
      :game.attempted&&!game.over?'표시된 백돌을 잡지 못했어요. 무르기로 다시 풀어 보세요.'
      :game.kind==='puzzle'?'테두리로 표시된 백돌을 한 수로 모두 잡으세요.'
      :selected>=0?`${G.coord(selected)} 미리보기 · 여기에 두기를 눌러 확정하세요.`:'내 차례 · 빈 점을 골라 주세요.';
    $('move-detail').textContent=selected>=0?`${G.coord(selected)} · 확정 전입니다. 다른 점을 고르거나 다시 눌러 취소하세요.`:`${game.ply}수 · 무르기 ${game.undoUsed}회 · 추천 ${game.hintsUsed}회${game.kind==='puzzle'?' · 시도 '+game.attempts+'회':''}`;
    $('board-help').textContent=game.kind==='puzzle'?'실패해도 무르기로 다시 풀 수 있어요. 시간 제한은 없어요.':'영역 계가 · 백 덤 6.5 · 두 번 연속 쉬면 계가 확인';
  }
  function start(state){
    cancelSearch();stopClock();disarm();game=state;paused=false;finished=false;selected=-1;hinted=-1;cursor=40;zoomed=false;
    buildBoard();M.markPlayed(ID);$('pause-overlay').hidden=true;screen('game-screen');render();save();startClock();
    if(game.kind==='match'&&game.phase==='play'&&game.turn===G.WHITE)calculate('ai');
  }
  function startDaily(){const day=M.todayKey(),saved=loadGame();start(saved?.daily===day?saved:G.create('medium',{daily:day}));}
  function pick(i){
    if(!game||paused||thinking||finished||game.over)return;cursor=i;disarm();
    if(game.phase==='scoring'){if(G.toggleDead(game,i)){save();render();}return;}
    if(!ready())return;
    const t=G.tryMove(game,i);if(!t.ok){M.showToast(t.error==='suicide'?'활로가 없는 자충수라 둘 수 없어요.':t.error==='repeat'?'패: 이전과 같은 돌 배치를 만들 수 없어요. 다른 곳에 두세요.':'빈 점을 골라 주세요.');return;}
    selected=selected===i?-1:i;hinted=-1;render();points[i].focus({preventScroll:true});
  }
  function play(action){
    if(!G.move(game,action))return;selected=-1;hinted=-1;MaeilFx.play('stone');save();render();
    if(game.over){finish();return;}if(game.kind==='match'&&game.phase==='play'&&game.turn===G.WHITE)calculate('ai');
    else if(game.phase==='scoring')$('confirm-score-btn').focus();
  }
  function validAnswer(move,mode){return move&&(move.pass===true?game.kind==='match':G.tryMove(game,move.at).ok)&&(mode!=='hint'||game.kind!=='puzzle'||G.puzzleMoves(game).includes(move.at));}
  function calculate(mode){
    if(!game||game.over||paused||game.phase!=='play')return;cancelSearch();const id=requestId,copy=JSON.parse(JSON.stringify(game));thinking=mode;render();
    const options=mode==='hint'?{samples:4}:G.DIFFICULTIES[game.difficulty];
    const deliver=move=>{
      if(id!==requestId||paused||finished||$('game-screen').hidden)return;
      clearTimeout(watchdog);clearTimeout(computeTimer);requestId++;worker?.terminate();worker=null;thinking=false;
      if(!validAnswer(move,mode))move=AI.chooseMove(game,{samples:0});
      if(!move){render();M.showToast('계산을 마치지 못했어요. 이어하기로 다시 열어 주세요.');return;}
      if(mode==='hint'){
        game.hintsUsed++;if(move.pass){selected=-1;hinted=-1;M.showToast('한 수 쉬기를 추천해요. 직접 버튼을 눌러 주세요.');}
        else {selected=move.at;hinted=move.at;cursor=move.at;M.showToast(`${G.coord(move.at)}를 추천해요. 여기에 두기로 확정하세요.`);}
        save();render();if(selected>=0)points[selected].focus({preventScroll:true});return;
      }
      play(move);
    };
    const fallback=()=>{if(id!==requestId)return;clearTimeout(watchdog);worker?.terminate();worker=null;computeTimer=setTimeout(()=>{if(id!==requestId||paused||finished)return;deliver(AI.chooseMove(copy,{samples:0}));},0);};
    computeTimer=setTimeout(()=>{
      if(id!==requestId||paused)return;
      try{if(typeof Worker!=='function'){fallback();return;}worker=new Worker('js/ai-worker.js');
        worker.onmessage=({data})=>{if(data.id!==id||id!==requestId)return;data.error?fallback():deliver(data.move);};worker.onerror=e=>{e.preventDefault();fallback();};
        watchdog=setTimeout(fallback,6000);worker.postMessage({id,state:copy,options});
      }catch{fallback();}
    },mode==='ai'?250:20);
  }
  function undo(){if(!game||paused||finished||!G.canUndo(game))return;cancelSearch();disarm();G.undo(game);selected=-1;hinted=-1;save();render();}
  function pass(){if(ready()&&game.kind==='match'){disarm();play({pass:true});}}
  function resign(){if(!game||paused||finished||game.over||game.kind!=='match')return;
    if(armed!=='resign'){disarm();armed='resign';$('resign-btn').textContent='한 번 더 기권';M.showToast('기권하려면 5초 안에 한 번 더 눌러 주세요.');armTimer=setTimeout(disarm,5000);return;}
    cancelSearch();disarm();play({resign:true});
  }
  function tick(){if(!clock||!game)return;const now=performance.now();game.elapsed+=Math.max(0,now-lastTick)/1000;lastTick=now;}
  function stopClock(){tick();clearInterval(clock);clock=0;}
  function startClock(){stopClock();lastTick=performance.now();ticks=0;clock=setInterval(()=>{tick();if(++ticks%20===0)save();},250);}
  function pause(){if(!game||paused||finished||$('game-screen').hidden)return;stopClock();cancelSearch();disarm();paused=true;$('pause-overlay').hidden=false;render();save();$('resume-btn').focus();}
  function resume(){if(!game||!paused||finished)return;paused=false;$('pause-overlay').hidden=true;render();startClock();if(game.kind==='match'&&game.phase==='play'&&game.turn===G.WHITE)calculate('ai');}
  function finish(){
    if(finished||!game.over)return;stopClock();cancelSearch();disarm();finished=true;clearSave();render();
    const stats=loadStats(),key=game.daily?'daily':game.difficulty,old=stats[key]||{},won=game.winner===G.BLACK;
    const entry={played:count(old.played)+1,wins:count(old.wins)+Number(won)};stats[key]=entry;M.write(KEY.stats,stats);
    if(won&&game.daily){const record={date:game.daily,hints:game.hintsUsed,attempts:game.attempts},previous=M.read(KEY.daily);
      if(!previous||typeof previous.date!=='string'||previous.date<game.daily||previous.date===game.daily&&(record.hints<(previous.hints??Infinity)||record.hints===previous.hints&&record.attempts<(previous.attempts??Infinity)))M.write(KEY.daily,record);M.recordDaily(ID,game.daily);}
    summary();const s=G.score(game.board,game.dead);
    $('result-title').textContent=won?(game.daily?'백돌을 잡았어요!':'흑이 이겼어요!'):'백이 이겼어요';
    $('result-sub').textContent=`${label(game)} · ${game.reason==='resign'?'기권':game.reason==='puzzle'?'한 수 돌 잡기':'영역 계가 · 죽은 돌 직접 확인'}`;
    $('result-label').textContent=game.daily?'잡은 백돌':game.reason==='resign'?'승부':'영역 점수 · 흑 : 백 (덤 6.5 포함)';
    $('result-score').textContent=game.daily?`${game.targets.length}개`:game.reason==='resign'?'백 불계승':`${s.black} : ${s.white}`;
    $('result-detail').textContent=`무르기 ${game.undoUsed}회 · 추천 ${game.hintsUsed}회 · ${M.formatTime(game.elapsed)}`;
    $('result-record').textContent=`${entry.wins}승 · ${entry.played}판${game.daily?' · 시도 '+game.attempts+'회':''}`;
    $('result-note').textContent=game.daily?'정답 위치는 공유 문구에 넣지 않아요.':game.reason==='score'?`살아 있는 돌과 둘러싼 빈 점을 셌어요. 죽은 돌 ${game.dead.length}개는 사용자가 확인해 제외했습니다.`:'다음 판에서 다시 한 수 두어 보세요.';
    $('again-btn').textContent=game.daily?'오늘의 도전 다시':'한 판 더';screen('result-screen');MaeilFx.celebrate({isBest:false,won});$('again-btn').focus();
  }
  function onKey(e){
    if(!game||finished||$('game-screen').hidden||e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.repeat&&(e.key==='Enter'||e.key===' ')){e.preventDefault();return;}
    if(e.key==='Escape'){e.preventDefault();if(e.repeat)return;if(paused)resume();else if(selected>=0){selected=-1;hinted=-1;render();}else pause();return;}
    if(paused||thinking||!e.target.closest?.('#board'))return;
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-9,ArrowDown:9};
    if(Object.hasOwn(delta,e.key)){e.preventDefault();const to=cursor+delta[e.key];if(to<0||to>=81||(e.key==='ArrowLeft'&&cursor%9===0)||(e.key==='ArrowRight'&&cursor%9===8))return;cursor=to;render();points[to].focus({preventScroll:true});}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(cursor);}
  }
  M.bindSettingButtons();
  picker=MaeilStart.setup({id:ID,difficulties:Object.entries(G.DIFFICULTIES).map(([key,c])=>({key,label:c.label,detail:c.note})),bestText:key=>{const s=loadStats()[key];return s?`${count(s.wins)}승 · ${count(s.played)}판`:'';},onStart:key=>start(G.create(key)),onDaily:startDaily});
  $('continue-btn').addEventListener('click',()=>{const saved=loadGame();if(saved)start(saved);else renderStart();});
  $('home-btn').addEventListener('click',()=>{cancelSearch();stopClock();save();renderStart();});$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);
  $('place-btn').addEventListener('click',()=>{if(ready()&&selected>=0)play({at:selected});});$('undo-btn').addEventListener('click',undo);$('hint-btn').addEventListener('click',()=>{if(ready())calculate('hint');});$('pass-btn').addEventListener('click',pass);$('resign-btn').addEventListener('click',resign);
  $('confirm-score-btn').addEventListener('click',()=>{if(game&&!paused&&!finished&&game.phase==='scoring')play({score:game.dead});});
  $('resume-play-btn').addEventListener('click',()=>{if(game&&!paused&&!finished&&game.phase==='scoring'){play({resume:true});points[cursor].focus({preventScroll:true});}});
  $('reset-dead-btn').addEventListener('click',()=>{if(game&&!paused&&!finished&&game.phase==='scoring'){game.dead=[];save();render();}});
  $('clear-pick-btn').addEventListener('click',()=>{selected=-1;hinted=-1;disarm();render();});$('zoom-btn').addEventListener('click',()=>{zoomed=!zoomed;render();});
  $('again-btn').addEventListener('click',()=>game.daily?startDaily():start(G.create(game.difficulty)));$('result-home-btn').addEventListener('click',renderStart);
  $('share-btn').addEventListener('click',()=>M.share({title:'바둑 — 매일게임',text:`[매일게임 바둑] ${label(game)}\n${game.winner===G.BLACK?'흑 승리':'백 승리'}${game.reason==='score'?' · 죽은 돌 직접 확인 계가':''}\n무르기 ${game.undoUsed}회 · 추천 ${game.hintsUsed}회${game.daily?' · 시도 '+game.attempts+'회':''}\n함께 한 수 두어 보세요!`,url:M.pageUrl('go/')+(game.daily?'#daily':'')}));
  document.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{if(!finished&&!$('game-screen').hidden)pause();});window.addEventListener('pageshow',e=>{if(e.persisted&&!finished&&!$('game-screen').hidden)pause();});
  renderStart();summary();MaeilStart.handleDailyLink(startDaily);M.registerOffline('../');
})();
