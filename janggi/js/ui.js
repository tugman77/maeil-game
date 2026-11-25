(() => {
  const M=MaeilGame,G=Janggi,AI=JanggiAI,ID='janggi',$=id=>document.getElementById(id);
  const KEY={game:'maeil-game.janggi.game.v1',stats:'maeil-game.janggi.stats.v1',daily:'maeil-game.janggi.daily.v1',display:'maeil-game.janggi.display.v1'};
  let game=null,picker,selected=-1,hinted=null,cursor=76,points=[],paused=false,finished=false,thinking=false,worker=null,requestId=0,computeTimer=0,watchdog=0;
  let offered=null;
  let clock=0,lastTick=0,ticks=0,armed='',armTimer=0;
  const display=M.read(KEY.display);
  let hanja=typeof display?.hanja==='boolean'?display.hanja:true,zoomed=false;
  const label=s=>s.daily?`${M.dateLabel(s.daily)} 한 수 외통수`:G.DIFFICULTIES[s.difficulty].label;
  const loadStats=()=>{const s=M.read(KEY.stats);return s&&typeof s==='object'&&!Array.isArray(s)?s:{};};
  const loadGame=()=>{const s=M.read(KEY.game);return s&&!s.over?G.restore(s):null;};
  const save=()=>{if(game&&!game.over&&!finished)M.write(KEY.game,game);};
  const clearSave=()=>{try{localStorage.removeItem(KEY.game);}catch{}};
  const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  function summary(){const total=Object.values(loadStats()).reduce((a,s)=>({played:a.played+count(s?.played),wins:a.wins+count(s?.wins)}),{played:0,wins:0});if(total.played)M.setSummary(ID,`${total.wins}승 · ${total.played}판`);}
  function screen(id){['start-screen','game-screen','result-screen'].forEach(k=>{$(k).hidden=k!==id;});window.scrollTo(0,0);}
  function cancelSearch(){requestId++;clearTimeout(computeTimer);clearTimeout(watchdog);worker?.terminate();worker=null;thinking=false;}
  function disarm(){armed='';clearTimeout(armTimer);$('resign-btn').textContent='기권';}
  function renderStart(){
    cancelSearch();stopClock();disarm();const day=M.todayKey(),done=M.dailyDone(ID,day),saved=loadGame();
    picker.setDaily(`${M.dateLabel(day)} · ${done?'완료 · 한 수 외통수를 찾았어요':'같은 문제 · 초가 한 수로 외통 만들기'}`,done);
    $('continue-wrap').hidden=!saved;$('start-screen').classList.toggle('has-continue',Boolean(saved));
    if(saved)$('continue-info').textContent=`${label(saved)} · ${saved.kind==='puzzle'?'시도 '+saved.puzzleAttempts+'회':saved.ply+'수 진행'}`;
    picker.refresh();screen('start-screen');
  }
  function pieceText(v){
    if(!v)return '';const t=G.type(v);
    if(!hanja)return t===G.K?(v>0?'초':'한'):t===G.P?(v>0?'졸':'병'):G.NAMES[t];
    return t===G.K?(v>0?'楚':'漢'):t===G.P?(v>0?'卒':'兵'):{2:'士',3:'車',4:'包',5:'馬',6:'象'}[t];
  }
  function pieceName(v){return `${v>0?'내 초':'컴퓨터 한'} ${G.type(v)===G.P?(v>0?'졸':'병'):G.NAMES[G.type(v)]}`;}
  function pieceElement(v){
    const outer=document.createElement('span');outer.className='piece '+(G.type(v)===G.K?'piece-king':[G.A,G.P].includes(G.type(v))?'piece-small':'piece-major');outer.setAttribute('aria-hidden','true');
    const face=document.createElement('span');face.className='piece-face';face.textContent=pieceText(v);outer.append(face);return outer;
  }
  function renderCaptured(){
    // Compare with this game's starting board, including sparse daily puzzles.
    // Deriving the display preserves old saves and restores captures on undo.
    for(const [side,name] of [[G.HAN,'han'],[G.CHO,'cho']]){
      const tokens=[];
      for(const type of [G.R,G.C,G.H,G.E,G.A,G.P]){
        const v=side*type,n=game.initial.filter(p=>p===v).length-game.board.filter(p=>p===v).length;
        for(let i=0;i<n;i++){const item=document.createElement('li');item.className='captured-token '+name;item.setAttribute('aria-label',pieceName(v)+' · 잡힌 말');item.append(pieceElement(v));tokens.push(item);}
      }
      $('captured-'+name+'-count').textContent=`${tokens.length}개`;
      if(!tokens.length){const empty=document.createElement('li');empty.className='captured-empty';empty.textContent='아직 없어요';tokens.push(empty);}
      $('captured-'+name).replaceChildren(...tokens);
    }
    $('captured-panel').classList.toggle('hanja',hanja);
  }
  function buildBoard(){
    points=Array.from({length:90},(_,i)=>{const b=document.createElement('button');b.type='button';b.className='jg-cell';b.setAttribute('role','gridcell');b.addEventListener('click',()=>pick(i));return b;});
    $('board').replaceChildren(...points);
  }
  function render(){
    if(!game)return;const scores=G.points(game.board),legal=game.turn===G.CHO&&!game.over&&!game.puzzleAttempted?G.legalMoves(game):[];
    const targets=new Set(legal.filter(m=>m.from===selected).map(m=>m.to));
    const checked=G.inCheck(game.board,game.turn),king=game.board.indexOf(game.turn*G.K);
    points.forEach((b,i)=>{
      const v=game.board[i],classes=['jg-cell'];if(v)classes.push(v>0?'cho':'han');if(i===selected)classes.push('selected');
      if(targets.has(i))classes.push('legal',v?'capture':'empty');
      if(hinted&&!hinted.pass){if(i===hinted.from)classes.push('hint-from');if(i===hinted.to)classes.push('hint-to');}
      if(game.last&&(i===game.last.from||i===game.last.to))classes.push('last');if(checked&&i===king)classes.push('check');
      b.className=classes.join(' ');b.disabled=Boolean(paused||offered||thinking||game.over||game.turn!==G.CHO||game.puzzleAttempted);
      b.tabIndex=i===cursor?0:-1;b.setAttribute('aria-selected',String(i===selected));
      b.setAttribute('aria-label',`${Math.floor(i/9)+1}행 ${i%9+1}열, ${v?pieceName(v):'빈 점'}${targets.has(i)?', 이동 가능':''}${i===selected?', 선택됨':''}${checked&&i===king?', 장군':''}`);
      if(v)b.replaceChildren(pieceElement(v));else b.replaceChildren();
    });
    renderCaptured();
    $('play-area').inert=Boolean(paused||offered);$('home-btn').disabled=Boolean(paused||offered);$('pause-btn').disabled=Boolean(paused||offered);
    $('cho-points').textContent=scores.cho;$('han-points').textContent=scores.han;
    $('undo-btn').disabled=paused||!G.canUndo(game);$('hint-btn').disabled=Boolean(paused||thinking||game.over||game.turn!==G.CHO||game.puzzleAttempted);
    $('pass-btn').disabled=Boolean(paused||thinking||game.kind==='puzzle'||game.turn!==G.CHO||!G.canPass(game));
    $('pass-btn').classList.toggle('hinted',Boolean(hinted?.pass));$('clear-pick-btn').disabled=Boolean(paused||thinking||selected<0);
    $('resign-btn').disabled=paused||game.kind==='puzzle'||game.over;
    $('board').classList.toggle('hanja',hanja);$('script-btn').setAttribute('aria-pressed',String(hanja));$('zoom-btn').setAttribute('aria-pressed',String(zoomed));$('board-scroll').classList.toggle('zoomed',zoomed);
    $('game-label').textContent=`${label(game)} · 나는 아래 초로 둡니다`;
    $('game-status').textContent=paused?'일시정지 중':thinking?(thinking==='hint'?'추천할 수를 찾고 있어요…':'컴퓨터가 생각하고 있어요…')
      :game.over?`${game.winner===G.CHO?'초 승리':'한 승리'} · ${G.reasonText[game.reason]}`
      :game.puzzleAttempted?'한 수 외통이 아니에요. 무르기를 눌러 다시 풀어 보세요.'
      :checked?'장군! 궁을 지키는 수를 두세요. 한 수 쉴 수 없어요.'
      :game.bikjang?'빅장! 마주봄을 풀지 않으면 이번 응수 뒤 점수로 끝나요.'
      :game.kind==='puzzle'?'초가 한 수로 외통을 만드세요. 말과 이동할 점을 누르세요.':'내 차례 · 말을 누른 다음 표시된 이동할 점을 누르세요.';
    $('outcome-notice').textContent=game.outcomeText||'';
    $('move-detail').textContent=selected>=0?`${pieceName(game.board[selected])} · ${G.coord(selected)} · 이동 가능한 곳 ${targets.size}개`
      :`무르기 ${game.undoUsed}회 · 추천 ${game.hintsUsed}회${game.kind==='puzzle'?' · 시도 '+game.puzzleAttempts+'회':' · '+game.ply+'수'}`;
    $('board-help').textContent=game.kind==='puzzle'?'실패해도 무르기로 다시 풀 수 있어요. 추천은 정답 수를 표시해요.':'한의 덤 1.5점 · 서로 한 수 쉬면 점수로 종료';
  }
  function start(state){
    cancelSearch();stopClock();disarm();game=state;offered=null;$('outcome-overlay').hidden=true;paused=false;finished=false;selected=-1;hinted=null;cursor=state.board.findIndex(v=>v>0);zoomed=false;
    buildBoard();M.markPlayed(ID);$('pause-overlay').hidden=true;screen('game-screen');render();save();startClock();
    if(game.over){finish();return;}
    if(game.kind==='match'&&game.turn===G.HAN)calculate('ai');
    else if(game.kind==='match'&&game.actions.length)calculate('assess');
  }
  function startDaily(){const day=M.todayKey(),saved=loadGame();start(saved?.daily===day?saved:G.create('medium',{daily:day}));}
  function pick(i){
    if(!game||paused||offered||thinking||game.over||game.turn!==G.CHO||game.puzzleAttempted)return;
    disarm();cursor=i;
    if(selected===i){selected=-1;hinted=null;render();points[i].focus({preventScroll:true});return;}
    const action={from:selected,to:i};
    if(selected>=0&&G.isLegal(game,action)){play(action);return;}
    if(game.board[i]>0){selected=i;hinted=null;render();points[i].focus({preventScroll:true});return;}
    M.showToast('먼저 내 말을 고르고, 표시된 곳으로 옮겨 주세요.');
  }
  function play(action){
    if(!G.move(game,action))return;selected=-1;hinted=null;MaeilFx.play('stone');render();save();
    if(game.over){finish();return;}if(offer(null))return;if(game.kind==='match'&&game.turn===G.HAN)calculate('ai');
  }
  function offer(report){
    const d=G.decision(game,report);if(!d)return false;
    game.outcomeText=d.text;save();
    if(d.winner===G.CHO){G.resign(game,G.HAN);finish();return true;}
    if(game.continueDecided){render();return false;}
    offered=d;stopClock();$('outcome-title').textContent=d.text;
    $('outcome-overlay').hidden=false;render();$('outcome-continue').focus();return true;
  }
  function calculate(mode){
    if(!game||game.over||paused||offered)return;cancelSearch();const id=requestId,copy=JSON.parse(JSON.stringify(game));thinking=mode;render();
    const options=mode==='hint'?{depth:4,nodes:12000,timeMs:700}:mode==='assess'?{...G.DIFFICULTIES[game.difficulty],depth:5,timeMs:700}:G.DIFFICULTIES[game.difficulty];
    const deliver=(move,report)=>{
      if(id!==requestId||paused||finished||$('game-screen').hidden)return;
      clearTimeout(watchdog);clearTimeout(computeTimer);requestId++;worker?.terminate();worker=null;thinking=false;
      if(mode!=='hint'&&offer(report))return;
      if(mode==='assess'){save();render();return;}
      if(!G.isLegal(game,move)||(mode==='hint'&&game.kind==='puzzle'&&!G.matingMoves(game).some(a=>G.sameAction(a,move))))move=AI.chooseMove(game,{depth:1,nodes:240})||G.legalActions(game)[0]||null;
      if(!move){render();M.showToast('수를 계산하지 못했어요. 이어하기로 다시 열어 주세요.');return;}
      if(mode==='hint'){hinted=move;selected=move.pass?-1:move.from;if(!move.pass)cursor=move.from;game.hintsUsed++;save();render();if(!move.pass)points[cursor].focus({preventScroll:true});M.showToast(move.pass?'한 수 쉬는 수를 추천해요. 직접 버튼을 눌러 주세요.':`${G.coord(move.from)}에서 ${G.coord(move.to)}로 이동을 추천해요.`);return;}
      G.move(game,move);MaeilFx.play('stone',{ai:true});save();render();if(game.over)finish();else offer(null);
    };
    const fallback=()=>{
      if(id!==requestId)return;clearTimeout(watchdog);worker?.terminate();worker=null;
      computeTimer=setTimeout(()=>{if(id!==requestId||paused||finished)return;const report=AI.analyze(copy,{depth:1,nodes:240,timeMs:70});deliver(report.move,report);},0);
    };
    computeTimer=setTimeout(()=>{
      if(id!==requestId||paused)return;
      try{if(typeof Worker!=='function'){fallback();return;}worker=new Worker('js/ai-worker.js');
        worker.onmessage=({data})=>{if(data.id!==id||id!==requestId)return;data.error?fallback():deliver(data.move,data.report);};worker.onerror=event=>{event.preventDefault();fallback();};
        watchdog=setTimeout(fallback,6000);worker.postMessage({id,state:copy,options});
      }catch{fallback();}
    },mode==='ai'?120:20);
  }
  function undo(){if(!game||paused||offered||finished||!G.canUndo(game))return;cancelSearch();disarm();G.undo(game);selected=-1;hinted=null;save();render();if(game.over)finish();else if(game.kind==='match'&&game.actions.length)calculate('assess');}
  function hint(){if(game&&!paused&&!offered&&!thinking&&!game.over&&game.turn===G.CHO&&!game.puzzleAttempted)calculate('hint');}
  function pass(){if(game&&!paused&&!offered&&!thinking&&game.kind==='match'&&game.turn===G.CHO&&G.canPass(game)){disarm();play({pass:true});}}
  function resign(){
    if(!game||paused||offered||game.over||game.kind!=='match')return;
    if(armed!=='resign'){disarm();armed='resign';$('resign-btn').textContent='한 번 더 기권';M.showToast('기권하려면 5초 안에 한 번 더 눌러 주세요.');armTimer=setTimeout(disarm,5000);return;}
    cancelSearch();disarm();G.resign(game);finish();
  }
  function tick(){if(!clock||!game)return;const now=performance.now();game.elapsed+=Math.max(0,now-lastTick)/1000;lastTick=now;}
  function stopClock(){tick();clearInterval(clock);clock=0;}
  function startClock(){stopClock();lastTick=performance.now();ticks=0;clock=setInterval(()=>{tick();if(++ticks%20===0)save();},250);}
  function pause(){if(!game||paused||offered||finished||$('game-screen').hidden)return;stopClock();cancelSearch();disarm();paused=true;$('pause-overlay').hidden=false;render();save();$('resume-btn').focus();}
  function resume(){if(!game||!paused||finished)return;paused=false;$('pause-overlay').hidden=true;render();startClock();if(game.kind==='match')calculate(game.turn===G.HAN?'ai':'assess');}
  function finish(){
    if(finished||!game.over)return;stopClock();cancelSearch();disarm();finished=true;clearSave();render();
    const stats=loadStats(),key=game.daily?'daily':game.difficulty,old=stats[key]||{},won=game.winner===G.CHO;
    const entry={played:count(old.played)+1,wins:count(old.wins)+Number(won)};stats[key]=entry;M.write(KEY.stats,stats);
    if(won&&game.daily){const record={date:game.daily,hints:game.hintsUsed,attempts:game.puzzleAttempts,seconds:Math.floor(game.elapsed)},previous=M.read(KEY.daily);
      if(!previous||typeof previous.date!=='string'||previous.date<game.daily||(previous.date===game.daily&&(record.hints<(previous.hints??Infinity)||(record.hints===previous.hints&&record.attempts<(previous.attempts??Infinity)))))M.write(KEY.daily,record);
      M.recordDaily(ID,game.daily);
    }
    summary();const scores=G.points(game.board);$('result-title').textContent=won?(game.daily?'외통수를 찾았어요!':'초가 이겼어요!'):'한이 이겼어요';
    $('result-sub').textContent=`${label(game)} · ${G.reasonText[game.reason]}${game.reason==='resign'&&won?' · 컴퓨터 기권':''}${game.outcomeText?' · '+game.outcomeText:''}`;$('result-score').textContent=`${scores.cho} : ${scores.han}`;
    $('result-detail').textContent=`무르기 ${game.undoUsed}회 · 추천 ${game.hintsUsed}회 · ${M.formatTime(game.elapsed)}`;
    $('result-record').textContent=`${entry.wins}승 · ${entry.played}판${game.daily?' · 시도 '+game.puzzleAttempts+'회':''}`;
    $('result-note').textContent=game.daily?'정답 수는 공유 문구에 넣지 않아요.':game.reason==='mate'?'외통수 승부이며 위 점수는 남은 기물의 참고 점수입니다.':'남은 기물 점수로 판정할 때 한은 덤 1.5점을 받습니다.';
    $('again-btn').textContent=game.daily?'오늘의 도전 다시':'한 판 더';screen('result-screen');MaeilFx.celebrate({isBest:false,won});$('again-btn').focus();
  }
  function onKey(e){
    if(!game||finished||$('game-screen').hidden||e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.repeat&&(e.key==='Enter'||e.key===' ')){e.preventDefault();return;}
    if(e.key==='Escape'){e.preventDefault();if(e.repeat)return;if(paused)resume();else if(selected>=0){selected=-1;hinted=null;render();}else pause();return;}
    if(paused||offered||thinking||!e.target.closest?.('#board'))return;
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-9,ArrowDown:9};
    if(Object.hasOwn(delta,e.key)){e.preventDefault();const to=cursor+delta[e.key];if(to<0||to>=90||(e.key==='ArrowLeft'&&cursor%9===0)||(e.key==='ArrowRight'&&cursor%9===8))return;cursor=to;render();points[to].focus({preventScroll:true});}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)pick(cursor);}
  }
  M.bindSettingButtons();
  picker=MaeilStart.setup({id:ID,difficulties:Object.entries(G.DIFFICULTIES).map(([key,c])=>({key,label:c.label,detail:c.note})),bestText:key=>{const s=loadStats()[key];return s?`${count(s.wins)}승 · ${count(s.played)}판`:'';},onStart:key=>start(G.create(key,{formation:Number($('formation-select').value||0)})),onDaily:startDaily});
  $('outcome-continue').addEventListener('click',()=>{if(!offered)return;offered=null;game.continueDecided=true;$('outcome-overlay').hidden=true;save();render();startClock();if(game.turn===G.HAN)calculate('ai');});
  $('outcome-new').addEventListener('click',()=>{if(!offered)return;offered=null;$('outcome-overlay').hidden=true;G.resign(game);finish();start(G.create(game.difficulty,{formation:game.formation}));});
  $('continue-btn').addEventListener('click',()=>{const saved=loadGame();if(saved)start(saved);else renderStart();});
  $('home-btn').addEventListener('click',()=>{cancelSearch();stopClock();save();renderStart();});$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);
  $('undo-btn').addEventListener('click',undo);$('hint-btn').addEventListener('click',hint);$('pass-btn').addEventListener('click',pass);$('resign-btn').addEventListener('click',resign);
  $('clear-pick-btn').addEventListener('click',()=>{selected=-1;hinted=null;disarm();render();});
  $('script-btn').addEventListener('click',()=>{hanja=!hanja;M.write(KEY.display,{hanja});render();});$('zoom-btn').addEventListener('click',()=>{zoomed=!zoomed;render();});
  $('again-btn').addEventListener('click',()=>game.daily?startDaily():start(G.create(game.difficulty,{formation:game.formation})));$('result-home-btn').addEventListener('click',renderStart);
  $('share-btn').addEventListener('click',()=>M.share({title:'장기 — 매일게임',text:`[매일게임 장기] ${label(game)}\n${game.winner===G.CHO?'초 승리':'한 승리'} · ${G.reasonText[game.reason]}\n무르기 ${game.undoUsed}회 · 추천 ${game.hintsUsed}회${game.daily?' · 시도 '+game.puzzleAttempts+'회':''}\n함께 한 수 두어 보세요!`,url:M.pageUrl('janggi/')+(game.daily?'#daily':'')}));
  document.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{if(!finished&&!$('game-screen').hidden)pause();});window.addEventListener('pageshow',e=>{if(e.persisted&&!finished&&!$('game-screen').hidden)pause();});
  renderStart();summary();MaeilStart.handleDailyLink(startDaily);M.registerOffline('../');
})();
