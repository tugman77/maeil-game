(() => {
  const M=MaeilGame,G=WordSearch,ID='word-search',$=id=>document.getElementById(id);
  const KEY={game:`maeil-game.${ID}.game.v1`,stats:`maeil-game.${ID}.stats.v1`};
  let game=null,first=null,paused=false,finished=false,picker;
  const label=s=>s.daily?`${M.dateLabel(s.daily)} 오늘의 도전`:G.DIFFICULTIES[s.difficulty].label;
  const loadGame=()=>{const s=M.read(KEY.game);return G.isValid(s)&&!G.isDone(s)?s:null;};
  const stats=()=>{const s=M.read(KEY.stats);return s&&typeof s==='object'&&!Array.isArray(s)?s:{};};
  const validRecord=r=>r&&Number.isSafeInteger(r.hints)&&r.hints>=0&&r.hints<=8&&Number.isSafeInteger(r.played)&&r.played>0;
  const save=()=>{if(game&&!finished&&!G.isDone(game))M.write(KEY.game,game);};
  const message=s=>{$('game-status').textContent=s;};
  function screen(id){['start-screen','game-screen','result-screen'].forEach(k=>{$(k).hidden=k!==id;});window.scrollTo(0,0);}
  function renderStart(){
    const saved=loadGame(),day=M.todayKey();first=null;paused=false;picker.refresh();
    picker.setDaily(`${M.dateLabel(day)} · 같은 6×6 판 · 6단어`,M.dailyDone(ID,day));
    $('continue-wrap').hidden=!saved;$('start-screen').classList.toggle('has-continue',!!saved);
    if(saved)$('continue-info').textContent=`${label(saved)} · ${saved.found.length}/${saved.words.length}단어`;
    screen('start-screen');
  }
  function start(s){game=s;first=null;paused=false;finished=false;$('pause-overlay').hidden=true;M.markPlayed(ID);screen('game-screen');message('첫 글자와 끝 글자를 차례로 누르세요.');render();save();}
  function startDaily(){const day=M.todayKey(),saved=loadGame();start(saved?.daily===day?saved:G.create('normal',{daily:day}));}
  function render(){
    $('play-area').inert=paused;$('home-btn').disabled=paused;$('pause-btn').disabled=paused;
    $('game-label').textContent=label(game);$('theme').textContent=game.theme;$('progress').textContent=`${game.found.length} / ${game.words.length}단어`;
    $('direction-info').textContent=game.difficulty==='easy'?'오른쪽·아래쪽으로 읽어 보세요.':game.difficulty==='normal'?'오른쪽·아래쪽·오른쪽 아래 대각선으로 찾아요.':'가로·세로·대각선, 거꾸로 읽는 단어도 있어요.';
    const found=new Set(game.found.flatMap(i=>game.placements[i])),hinted=new Set(game.hinted.filter(i=>!game.found.includes(i)).map(i=>game.placements[i][0]));
    $('board').style.setProperty('--size',game.size);
    $('board').replaceChildren(...game.grid.map((char,i)=>{
      const b=document.createElement('button');b.type='button';b.className=`letter-cell${found.has(i)?' found':''}${hinted.has(i)?' hinted':''}${first===i?' selected':''}`;b.textContent=char;b.disabled=paused;
      b.setAttribute('aria-label',`${Math.floor(i/game.size)+1}행 ${i%game.size+1}열 ${char}${first===i?', 시작 글자 선택됨':''}${found.has(i)?', 찾은 단어':''}${hinted.has(i)?', 힌트 첫 글자':''}`);b.setAttribute('aria-pressed',String(first===i));
      b.addEventListener('click',()=>choose(i));
      b.addEventListener('keydown',e=>{
        const row=Math.floor(i/game.size),col=i%game.size,delta={ArrowLeft:col>0?-1:0,ArrowRight:col<game.size-1?1:0,ArrowUp:row>0?-game.size:0,ArrowDown:row<game.size-1?game.size:0}[e.key];
        if(delta!==undefined){e.preventDefault();$('board').children[i+delta].focus();}
      });return b;
    }));
    $('word-list').replaceChildren(...game.words.map((word,i)=>{const li=document.createElement('li'),done=game.found.includes(i);li.textContent=word;li.className=done?'done':'';li.setAttribute('aria-label',`${word}, ${done?'찾음':'찾을 단어'}`);return li;}));
    $('cancel-btn').disabled=paused||first===null;$('undo-btn').disabled=paused||!game.found.length;$('hint-btn').disabled=paused||game.words.every((_,i)=>game.found.includes(i)||game.hinted.includes(i));
    $('hint-info').textContent=`힌트 ${game.hints}회 · 점선 칸은 아직 못 찾은 단어의 첫 글자예요.`;
  }
  function choose(i){
    if(paused||finished)return;
    if(first===null){first=i;message(`‘${game.grid[i]}’에서 시작해요. 끝 글자를 누르세요.`);}
    else if(first===i){first=null;message('선택을 취소했어요. 첫 글자를 다시 누르세요.');}
    else{const result=G.select(game,first,i);first=null;
      message(result==='found'?'찾았어요! 밑줄 친 글자는 다른 단어에도 쓰일 수 있어요.':result==='repeated'?'이미 찾은 단어예요. 다른 단어를 찾아보세요.':'목록의 단어를 가로·세로·대각선의 곧은 줄로 찾아보세요.');
      if(result==='found')MaeilFx.play('match');if(G.isDone(game)){finish();return;}
    }
    render();save();$('board').children[i].focus({preventScroll:true});
  }
  function pause(){if(!game||finished||paused||$('game-screen').hidden)return;paused=true;first=null;save();render();$('pause-overlay').hidden=false;$('resume-btn').focus();}
  function resume(){paused=false;$('pause-overlay').hidden=true;render();$('board').children[0].focus();}
  function finish(){
    if(finished)return;finished=true;try{localStorage.removeItem(KEY.game);}catch{}
    const all=stats(),key=game.daily?'daily':game.difficulty,old=all[key],best=!validRecord(old)||game.hints<old.hints;
    all[key]={hints:best?game.hints:old.hints,played:validRecord(old)?old.played+1:1};M.write(KEY.stats,all);
    if(game.daily)M.recordDaily(ID,game.daily);
    M.setSummary(ID,`${label(game)} · ${game.words.length}단어 완료 · 힌트 ${all[key].hints}회`);
    $('result-sub').textContent=`${label(game)} · ${game.theme}`;$('result-score').textContent=`${game.words.length} / ${game.words.length}`;
    $('result-detail').textContent=`힌트 ${game.hints}회 사용`;$('result-best').textContent=`${best?'새 최고 기록':'내 최고'} · 힌트 ${all[key].hints}회`;
    $('review-list').replaceChildren(...game.words.map(w=>{const li=document.createElement('li');li.textContent=`✓ ${w}`;return li;}));
    $('again-btn').textContent=game.daily?'오늘의 도전 다시':'새 단어판';screen('result-screen');MaeilFx.celebrate({isBest:best,won:true});$('again-btn').focus();
  }
  M.bindSettingButtons();
  picker=MaeilStart.setup({id:ID,defaultKey:"normal",difficulties:Object.entries(G.DIFFICULTIES).map(([key,v])=>({key,label:v.label,detail:v.detail})),bestText:key=>validRecord(stats()[key])?`내 최고 · 힌트 ${stats()[key].hints}회`:'',onStart:key=>start(G.create(key)),onDaily:startDaily});
  $('continue-btn').addEventListener('click',()=>{const s=loadGame();s?start(s):renderStart();});
  $('home-btn').addEventListener('click',()=>{save();renderStart();});$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);
  $('cancel-btn').addEventListener('click',()=>{first=null;message('선택을 취소했어요.');render();$('board').children[0].focus();});
  $('undo-btn').addEventListener('click',()=>{if(paused||finished||!G.undo(game))return;first=null;message('마지막으로 찾은 단어를 되돌렸어요. 힌트 사용 기록은 유지돼요.');render();save();});
  $('hint-btn').addEventListener('click',()=>{if(paused||finished)return;const i=G.hint(game);if(i<0)return;first=null;message(`‘${game.words[i]}’의 첫 글자를 점선으로 표시했어요.`);render();save();$('board').children[game.placements[i][0]].focus();});
  $('again-btn').addEventListener('click',()=>game.daily?startDaily():start(G.create(game.difficulty)));$('result-home-btn').addEventListener('click',renderStart);
  $('share-btn').addEventListener('click',()=>M.share({title:'한글 단어 찾기 — 매일게임',text:G.shareText(game),url:M.pageUrl('word-search/')+(game.daily?'#daily':'')}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&game&&!finished&&!$('game-screen').hidden){e.preventDefault();if(paused)resume();else if(first!==null){first=null;message('선택을 취소했어요.');render();$('board').children[0].focus();}else pause();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);window.addEventListener('pageshow',e=>{if(e.persisted)pause();});
  renderStart();MaeilStart.handleDailyLink(startDaily);M.registerOffline('../');
})();
