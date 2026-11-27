(() => {
  const M = MaeilGame, G = ProverbQuiz, ID = G.ID, $ = id => document.getElementById(id);
  const KEY = { game:`maeil-game.${ID}.game.v1`, stats:`maeil-game.${ID}.stats.v1`, daily:`maeil-game.${ID}.daily.v1` };
  let game = null, picker, paused = false, finished = false;
  const label = s => s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : G.DIFFICULTIES[s.difficulty].label;
  const spaceAfter = q => q.spaceAfter ?? !/^[.,!?…]/u.test(q.after);
  const fullProverb = (q, answer) => `${q.before}${q.spaceBefore === false ? '' : ' '}${answer}${spaceAfter(q) ? ' ' : ''}${q.after}`;
  const loadStats = () => { const s=M.read(KEY.stats);return s&&typeof s==='object'&&!Array.isArray(s)?s:{}; };
  const loadGame = () => { const s=M.read(KEY.game);return G.isValid(s)&&!G.isDone(s)?s:null; };
  const save = () => { if(game&&!finished&&!G.isDone(game))M.write(KEY.game,game); };
  const clearSave = () => { try{localStorage.removeItem(KEY.game);}catch{} };
  const recordOK = r => r&&Number.isInteger(r.correct)&&r.correct>=0&&r.correct<=G.COUNT
    &&Number.isInteger(r.revealed)&&r.revealed>=0&&r.revealed<=G.COUNT-r.correct
    &&Number.isInteger(r.hints)&&r.hints>=0&&r.hints<=G.COUNT*2
    &&Number.isInteger(r.mistakes)&&r.mistakes>=0&&r.mistakes<=G.COUNT*2;
  const better = (a,b) => !recordOK(b)||a.correct>b.correct||(a.correct===b.correct&&(a.hints<b.hints||(a.hints===b.hints&&a.mistakes<b.mistakes)));
  const recordText = r => `직접 맞힘 ${r.correct}/5 · 힌트 ${r.hints}회`;
  function summary(){
    const stats=loadStats(),keys=Object.keys(G.DIFFICULTIES).filter(k=>recordOK(stats[k]?.best)).sort((a,b)=>(stats[b].played||0)-(stats[a].played||0));
    if(keys.length)M.setSummary(ID,`${G.DIFFICULTIES[keys[0]].label} · ${recordText(stats[keys[0]].best)}`);
  }
  function screen(id){['start-screen','game-screen','result-screen'].forEach(key=>{$(key).hidden=key!==id;});window.scrollTo(0,0);}
  function renderStart(){
    const day=M.todayKey(),done=M.dailyDone(ID,day),result=M.read(KEY.daily),saved=loadGame();
    picker.setDaily(done&&result?.date===day&&recordOK(result)?`${M.dateLabel(day)} · ${recordText(result)}`:`${M.dateLabel(day)} · 같은 속담 5문제`,done);
    $('continue-wrap').hidden=!saved;$('start-screen').classList.toggle('has-continue',Boolean(saved));
    if(saved)$('continue-info').textContent=`${label(saved)} · ${saved.index+1}/5문제`;
    picker.refresh();screen('start-screen');
  }
  function start(state){
    game=state;paused=false;finished=false;M.markPlayed(ID);$('pause-overlay').hidden=true;screen('game-screen');
    $('game-status').textContent='알맞은 말을 골라 속담을 완성해 주세요.';render();save();
  }
  function startDaily(){const day=M.todayKey(),saved=loadGame();start(saved?.daily===day?saved:G.create(G.DAILY_DIFFICULTY,{daily:day}));}
  function render(){
    if(!game||G.isDone(game))return;
    const r=G.current(game),q=G.question(game),active=r.status==='playing',result=r.status!=='playing';
    $('play-area').inert=paused;$('home-btn').disabled=paused;$('pause-btn').disabled=paused;
    $('question-number').textContent=`${game.index+1}/5`;$('correct-count').textContent=G.score(game).correct;$('game-label').textContent=label(game);
    $('category').textContent=q.category;$('phrase-before').textContent=q.before+(q.spaceBefore===false?'':' ');$('phrase-after').textContent=(spaceAfter(q)?' ':'')+q.after;
    $('phrase-blank').textContent=result?q.answer:'빈칸';
    $('choice-list').replaceChildren(...r.options.map((option,i)=>{
      const b=document.createElement('button');b.type='button';b.className='choice-btn';b.textContent=option;
      const selected=r.status==='correct'&&r.chosen===i,wrong=r.attempts.includes(i);
      if(selected)b.classList.add('correct');if(wrong)b.classList.add('wrong');
      b.disabled=paused||!active||wrong;b.setAttribute('aria-pressed',String(selected));
      b.setAttribute('aria-label',`${option}${selected?', 정답':''}${wrong?', 다시 고를 수 없음':''}`);
      b.addEventListener('click',()=>choose(i));return b;
    }));
    $('hint-text').textContent=G.hintText(game)||'힌트를 누르면 추가 설명을 볼 수 있어요.';
    $('hint-btn').disabled=paused||!active||r.hints>=2;$('reveal-btn').disabled=paused||!active;
    $('explanation').hidden=!result;
    if(result){
      $('answer-line').textContent=fullProverb(q,q.answer);
      $('explanation-text').textContent=q.note;
      $('next-btn').textContent=game.index===G.COUNT-1?'결과 보기':'다음 속담';$('next-btn').disabled=paused;
      if(r.status==='correct')$('game-status').textContent='맞혔어요! 속담의 뜻도 확인해 보세요.';
      else $('game-status').textContent='정답을 확인했어요. 뜻풀이를 읽고 다음으로 가세요.';
    }
  }
  function choose(index){
    if(!game||paused||finished)return;
    const result=G.choose(game,index);if(result==='inactive')return;
    if(result==='correct'){ $('game-status').textContent='맞혔어요! 속담의 뜻도 확인해 보세요.';MaeilFx.play('match'); }
    else { $('game-status').textContent='그 답은 아니에요. 다시 골라 보세요.';MaeilFx.play('tap'); }
    render();save();
    if(result==='correct')$('next-btn').focus({preventScroll:true});
    else {const next=[...$('choice-list').children].find(b=>!b.disabled);next?.focus({preventScroll:true});}
  }
  function showHint(){if(!game||paused||finished||!G.hint(game))return;render();save();$('hint-btn').focus({preventScroll:true});}
  function reveal(){if(!game||paused||finished||!G.reveal(game))return;render();save();$('next-btn').focus({preventScroll:true});}
  function next(){
    if(!game||paused||finished||!G.next(game))return;
    if(G.isDone(game)){finish();return;}
    $('game-status').textContent='알맞은 말을 골라 속담을 완성해 주세요.';render();save();
    [...$('choice-list').children].find(b=>!b.disabled)?.focus({preventScroll:true});
  }
  function pause(){if(!game||paused||finished||$('game-screen').hidden)return;paused=true;$('pause-overlay').hidden=false;render();save();$('resume-btn').focus();}
  function resume(){if(!game||!paused||finished)return;paused=false;$('pause-overlay').hidden=true;render();[...$('choice-list').children].find(b=>!b.disabled)?.focus({preventScroll:true});}
  function finish(){
    if(finished)return;finished=true;clearSave();const result=G.score(game),key=game.daily?'daily':game.difficulty,stats=loadStats(),old=stats[key],best=better(result,old?.best);
    stats[key]={played:(Number.isSafeInteger(old?.played)&&old.played>=0?old.played:0)+1,best:best?result:old.best};
    M.write(KEY.stats,stats);
    if(game.daily){const previous=M.read(KEY.daily);if(!previous||typeof previous.date!=='string'||previous.date<game.daily||(previous.date===game.daily&&better(result,previous)))M.write(KEY.daily,{date:game.daily,...result});M.recordDaily(ID,game.daily);}
    summary();$('result-title').textContent=result.correct===G.COUNT?'속담 다섯 개를 모두 맞혔어요!':'한 판을 마쳤어요';
    $('result-sub').textContent=label(game);$('result-score').textContent=`${result.correct}/5`;
    $('result-detail').textContent=`힌트 ${result.hints}회 · 정답 보기 ${result.revealed}개 · 오답 ${result.mistakes}회`;
    $('result-best').textContent=`${best?'새 최고 기록 · ':'내 최고 · '}${recordText(stats[key].best)}`;
    $('review-list').replaceChildren(...game.rounds.map((round,i)=>{
      const q=ProverbQuizBank.questions.find(item=>item.id===round.id),li=document.createElement('li');
      li.textContent=`${i+1}. ${fullProverb(q,q.answer)} — ${round.status==='correct'?'직접 완성':'정답 확인'}`;return li;
    }));
    $('again-btn').textContent=game.daily?'오늘의 도전 다시':'새 속담 5개';screen('result-screen');MaeilFx.celebrate({isBest:best,won:result.correct===G.COUNT});$('again-btn').focus();
  }
  M.bindSettingButtons();
  picker=MaeilStart.setup({id:ID,difficulties:Object.entries(G.DIFFICULTIES).map(([key,c])=>({key,label:c.label,detail:c.detail})),bestText:key=>recordOK(loadStats()[key]?.best)?`내 최고 ${recordText(loadStats()[key].best)}`:'',onStart:key=>start(G.create(key)),onDaily:startDaily});
  $('continue-btn').addEventListener('click',()=>{const saved=loadGame();if(saved)start(saved);else renderStart();});
  $('home-btn').addEventListener('click',()=>{save();renderStart();});$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);
  $('hint-btn').addEventListener('click',showHint);$('reveal-btn').addEventListener('click',reveal);$('next-btn').addEventListener('click',next);
  $('again-btn').addEventListener('click',()=>game.daily?startDaily():start(G.create(game.difficulty)));$('result-home-btn').addEventListener('click',renderStart);
  $('share-btn').addEventListener('click',()=>M.share({title:'속담 완성 — 매일게임',text:G.shareText(game),url:M.pageUrl('proverb-quiz/')+(game.daily?'#daily':'')}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('pagehide',()=>{if(!finished&&!$('game-screen').hidden)save();});
  renderStart();summary();MaeilStart.handleDailyLink(startDaily);M.registerOffline('../');
})();
