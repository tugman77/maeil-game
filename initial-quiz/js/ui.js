(() => {
  const M=MaeilGame,G=InitialQuiz,ID='initial-quiz',$=id=>document.getElementById(id);
  const KEY={game:'maeil-game.initial-quiz.game.v1',stats:'maeil-game.initial-quiz.stats.v1',daily:'maeil-game.initial-quiz.daily.v1'};
  let game=null,picker,paused=false,finished=false,composing=false,shownId='',armed=false,armTimer=0;
  let timer=0,lastTick=0,ticks=0;
  const label=s=>s.daily?`${M.dateLabel(s.daily)} 오늘의 도전`:G.DIFFICULTIES[s.difficulty].label;
  const loadStats=()=>{const s=M.read(KEY.stats);return s&&typeof s==='object'&&!Array.isArray(s)?s:{};};
  const loadGame=()=>{const s=M.read(KEY.game);return G.isValid(s)&&!G.isDone(s)?s:null;};
  const save=()=>{if(game&&!finished&&!G.isDone(game))M.write(KEY.game,game);};
  const clearSave=()=>{try{localStorage.removeItem(KEY.game);}catch{}};
  const recordOK=r=>r&&Number.isInteger(r.correct)&&r.correct>=0&&r.correct<=5&&r.revealed===5-r.correct
    &&Number.isInteger(r.hints)&&r.hints>=0&&r.hints<=10&&Number.isInteger(r.mistakes)&&r.mistakes>=0&&Number.isFinite(r.seconds)&&r.seconds>=0;
  const better=(a,b)=>!recordOK(b)||a.correct>b.correct||(a.correct===b.correct&&(a.hints<b.hints||(a.hints===b.hints&&a.mistakes<b.mistakes)));
  const recordText=r=>`직접 맞힘 ${r.correct}/5 · 힌트 ${r.hints}회`;
  function summary() {
    const stats=loadStats(),keys=Object.keys(G.DIFFICULTIES).filter(k=>recordOK(stats[k]?.best)).sort((a,b)=>(stats[b].played||0)-(stats[a].played||0));
    if(keys.length)M.setSummary(ID,`${G.DIFFICULTIES[keys[0]].label} · ${recordText(stats[keys[0]].best)}`);
  }
  function screen(id){['start-screen','game-screen','result-screen'].forEach(key=>{$(key).hidden=key!==id;});window.scrollTo(0,0);}
  const message=text=>{$('game-status').textContent=text;};
  function disarm(){armed=false;clearTimeout(armTimer);$('reveal-btn').textContent='정답 보기';$('reveal-btn').classList.toggle('armed',false);}
  function renderStart(){
    stopTimer();disarm();const day=M.todayKey(),done=M.dailyDone(ID,day),result=M.read(KEY.daily),saved=loadGame();
    picker.setDaily(done&&result?.date===day&&recordOK(result)?`${M.dateLabel(day)} · ${recordText(result)}`:`${M.dateLabel(day)} · 모두 같은 세 글자 5문제`,done);
    $('continue-wrap').hidden=!saved;$('start-screen').classList.toggle('has-continue',Boolean(saved));
    if(saved)$('continue-info').textContent=`${label(saved)} · ${saved.index+1}/5문제`;
    picker.refresh();screen('start-screen');
  }
  function start(state){
    stopTimer();disarm();game=state;paused=false;finished=false;composing=false;shownId='';
    M.markPlayed(ID);$('pause-overlay').hidden=true;screen('game-screen');
    message('뜻을 읽고 아래 글자를 차례로 눌러 답을 만드세요.');render();save();startIfNeeded();
  }
  function startDaily(){const day=M.todayKey(),saved=loadGame();start(saved?.daily===day?saved:G.create(G.DAILY_DIFFICULTY,{daily:day}));}
  function render(){
    if(!game||G.isDone(game))return;
    const r=G.current(game),q=G.question(game),active=r.status==='playing',len=G.length(q),score=G.score(game);
    if(shownId!==q.id){shownId=q.id;composing=false;$('keyboard-mode').open=false;disarm();}
    $('play-area').inert=paused;$('home-btn').disabled=paused;$('pause-btn').disabled=paused;
    $('question-number').textContent=`${game.index+1}/5`;$('correct-count').textContent=score.correct;
    $('game-label').textContent=label(game);$('category').textContent=q.category;$('question-text').textContent=q.clue;
    $('initials').setAttribute('aria-label',`초성 ${[...G.initials(q.answers[0])].join(' ')}`);
    $('initials').replaceChildren(...[...G.initials(q.answers[0])].map(c=>{const span=document.createElement('span');span.textContent=c;span.setAttribute('aria-hidden','true');return span;}));
    const slots=Array.from({length:len},(_,i)=>{
      const b=document.createElement('button');b.type='button';b.className='answer-slot';b.textContent=r.draft[i]?.letter||'·';b.disabled=paused||!active||!r.draft[i];
      b.setAttribute('aria-label',`${i+1}번째 글자, ${r.draft[i]?.letter||'빈칸'}${r.draft[i]?', 누르면 지우기':''}`);
      b.addEventListener('click',()=>edit(()=>G.erase(game,i)));return b;
    });$('answer-slots').replaceChildren(...slots);
    $('tile-bank').replaceChildren(...r.tiles.map((letter,i)=>{
      const b=document.createElement('button');b.type='button';b.className='letter-tile';b.textContent=letter;
      const used=r.draft.some(x=>x.tile===i);b.disabled=paused||!active||used||r.draft.length>=len;
      b.setAttribute('aria-label',`글자 ${letter}${used?', 사용 중':''}`);b.setAttribute('aria-pressed',String(used));
      b.addEventListener('click',()=>edit(()=>G.addTile(game,i)));return b;
    }));
    const input=$('keyboard-answer'),text=G.draft(game);if(!composing&&input.value!==text)input.value=text;
    input.disabled=paused||!active;input.maxLength=len*3;input.setAttribute('aria-label',`정답 직접 입력, ${len}글자`);
    $('hint-info').textContent=G.hintText(game)||'힌트를 누르면 추가 설명을 볼 수 있어요.';
    $('question-counts').textContent=`이 문제: 힌트 ${r.hints}/2회 · 다른 답 확인 ${r.attempts.length}회`;
    $('submit-btn').hidden=!active;$('submit-btn').disabled=paused||r.draft.length!==len;
    $('erase-btn').disabled=paused||!active||!r.draft.length;$('undo-btn').disabled=paused||!active||!r.history.length;
    $('hint-btn').disabled=paused||!active||r.hints>=2;$('reveal-btn').disabled=paused||!active;
    $('answer-panel').hidden=active;$('answer-title').textContent=r.status==='correct'?'맞혔어요!':'정답을 확인했어요';
    $('shown-answer').textContent=active?'':q.answers.join(' · ');
    $('answer-note').textContent=r.status==='correct'?'다음 문제도 천천히 풀어 보세요.':'직접 맞힘에는 포함되지 않아요. 낱말을 익히고 다음으로 가세요.';
    $('next-btn').textContent=game.index===4?'결과 보기':'다음 문제';$('next-btn').disabled=paused||active;
  }
  function edit(action){
    if(!game||paused||finished)return;disarm();if(action()){message('답을 만들고 정답 확인을 누르세요.');render();save();startIfNeeded();MaeilFx.play('tap');const first=[...$('tile-bank').children].find(b=>!b.disabled);(first||$('submit-btn')).focus({preventScroll:true});}
  }
  function typed(){
    if(!game||paused||finished||composing)return;
    if(G.setText(game,$('keyboard-answer').value)){disarm();message('입력한 답을 확인해 주세요.');render();save();startIfNeeded();}
  }
  function submit(){
    if(!game||paused||finished||composing)return;
    if(G.normalize($('keyboard-answer').value||'')!==G.draft(game)){message('글자 수를 확인하고 한글로 입력해 주세요.');return;}
    disarm();const result=G.submit(game);
    if(result==='incomplete'){message(`${G.length(G.question(game))}글자를 모두 완성해 주세요.`);return;}
    if(result==='inactive')return;
    if(result==='correct'){message('정답이에요! 아래에서 다음 문제로 넘어가세요.');MaeilFx.play('match');}
    else if(result==='repeated')message('이미 확인한 답이에요. 다른 글자로 바꿔 보세요.');
    else {message('다른 답을 떠올려 보세요. 초성과 뜻을 다시 읽거나 힌트를 눌러도 좋아요.');MaeilFx.play('tap');}
    render();save();startIfNeeded();if(result==='correct')$('next-btn').focus();
  }
  function hint(){if(!game||paused||finished||!G.hint(game))return;disarm();message('추가 힌트를 아래에 표시했어요.');render();save();startIfNeeded();}
  function reveal(){
    if(!game||paused||finished||G.current(game).status!=='playing')return;
    if(!armed){armed=true;$('reveal-btn').textContent='한 번 더';$('reveal-btn').classList.toggle('armed',true);message('정답을 보면 직접 맞힘에는 포함되지 않아요. 한 번 더 누르면 정답을 보여 줍니다.');armTimer=setTimeout(disarm,5000);return;}
    disarm();G.reveal(game);message('정답을 확인했어요. 다음 문제로 계속할 수 있어요.');render();save();startIfNeeded();$('next-btn').focus();
  }
  function next(){
    if(!game||paused||finished||!G.next(game))return;
    disarm();if(G.isDone(game)){finish();return;}
    message('뜻을 읽고 글자를 골라 보세요.');render();save();$('question-text').focus();
  }
  function startIfNeeded(){if(game?.started&&!timer&&!paused&&!finished)startTimer();}
  function tick(){if(!timer||!game)return;const now=performance.now();game.elapsed+=Math.max(0,now-lastTick)/1000;lastTick=now;}
  function stopTimer(){tick();clearInterval(timer);timer=0;}
  function startTimer(){stopTimer();lastTick=performance.now();ticks=0;timer=setInterval(()=>{tick();if(++ticks%20===0)save();},250);}
  function pause(){if(!game||paused||finished||$('game-screen').hidden)return;stopTimer();paused=true;disarm();$('pause-overlay').hidden=false;render();save();$('resume-btn').focus();}
  function resume(){if(!game||!paused||finished)return;paused=false;$('pause-overlay').hidden=true;render();startIfNeeded();$('question-text').focus();}
  function finish(){
    if(finished)return;stopTimer();finished=true;clearSave();const record=G.score(game),key=game.daily?'daily':game.difficulty,stats=loadStats(),old=stats[key],best=better(record,old?.best);
    stats[key]={played:(Number.isSafeInteger(old?.played)&&old.played>=0?old.played:0)+1,best:best?record:old.best};M.write(KEY.stats,stats);
    if(game.daily){const previous=M.read(KEY.daily);if(!previous||typeof previous.date!=='string'||previous.date<game.daily||(previous.date===game.daily&&better(record,previous)))M.write(KEY.daily,{date:game.daily,...record});M.recordDaily(ID,game.daily);}
    summary();$('result-title').textContent=record.correct===5?'5문제 모두 맞혔어요!':'한 판을 마쳤어요';
    $('result-sub').textContent=label(game);$('result-score').textContent=`${record.correct}/5`;
    $('result-detail').textContent=`힌트 ${record.hints}회 · 정답 보기 ${record.revealed}문제 · ${M.formatTime(record.seconds)}`;
    $('result-best').textContent=`${best?'새 최고 기록 · ':'내 최고 · '}${recordText(stats[key].best)}`;
    $('review-list').replaceChildren(...game.rounds.map((r,i)=>{const q=InitialQuizWords.questions.find(q=>q.id===r.id),li=document.createElement('li');li.textContent=`${i+1}. ${q.answers.join(' · ')} — ${r.status==='correct'?'직접 맞힘':'정답 확인'}`;return li;}));
    $('again-btn').textContent=game.daily?'오늘의 도전 다시':'새 문제 5개';screen('result-screen');MaeilFx.celebrate({isBest:best,won:record.correct===5});$('again-btn').focus();
  }
  M.bindSettingButtons();
  picker=MaeilStart.setup({id:ID,difficulties:Object.entries(G.DIFFICULTIES).map(([key,c])=>({key,label:c.label,detail:c.detail})),bestText:key=>recordOK(loadStats()[key]?.best)?`내 최고 ${recordText(loadStats()[key].best)}`:'',onStart:key=>start(G.create(key)),onDaily:startDaily});
  $('continue-btn').addEventListener('click',()=>{const saved=loadGame();if(saved)start(saved);else renderStart();});
  $('home-btn').addEventListener('click',()=>{stopTimer();save();renderStart();});$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);
  $('submit-btn').addEventListener('click',submit);$('hint-btn').addEventListener('click',hint);$('reveal-btn').addEventListener('click',reveal);$('next-btn').addEventListener('click',next);
  $('erase-btn').addEventListener('click',()=>edit(()=>G.erase(game)));$('undo-btn').addEventListener('click',()=>edit(()=>G.undo(game)));
  $('keyboard-answer').addEventListener('compositionstart',()=>{composing=true;});$('keyboard-answer').addEventListener('compositionend',()=>{composing=false;typed();});
  $('keyboard-answer').addEventListener('input',event=>{if(!event.isComposing)typed();});
  $('again-btn').addEventListener('click',()=>game.daily?startDaily():start(G.create(game.difficulty)));$('result-home-btn').addEventListener('click',renderStart);
  $('share-btn').addEventListener('click',()=>M.share({title:'초성 퀴즈 — 매일게임',text:G.shareText(game),url:M.pageUrl('initial-quiz/')+(game.daily?'#daily':'')}));
  document.addEventListener('keydown',event=>{
    if(!game||finished||$('game-screen').hidden||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||composing||event.keyCode===229)return;
    if(event.repeat&&(event.key==='Enter'||event.key===' ')){event.preventDefault();return;}
    if(event.key==='Escape'){event.preventDefault();paused?resume():pause();return;}
    if(!paused&&event.key==='Enter'&&event.target===$('keyboard-answer')){event.preventDefault();submit();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{if(!finished&&!$('game-screen').hidden)pause();});
  window.addEventListener('pageshow',event=>{if(event.persisted&&!finished&&!$('game-screen').hidden)pause();});
  renderStart();summary();MaeilStart.handleDailyLink(startDaily);M.registerOffline('../');
})();
