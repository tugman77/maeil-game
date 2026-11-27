(() => {
  const G=HanjaGame, M=MaeilGame, B=HanjaBank, $=(id)=>document.getElementById(id);
  const SAVE='maeil-game.hanja.game.v1', BEST='maeil-game.hanja.best.v1', PICK='maeil-game.hanja.pick.v1';
  let state=null, paused=false, strokes=[], pointerId=null, chosenLang='zh', chosenMode='read';
  const loadPick=()=>M.read(PICK)||{};
  const bankItem=(r=G.current(state))=>G.itemFor(state,r);
  const key=(lang=chosenLang,mode=chosenMode,level='easy')=>`${lang}:${mode}:${level}`;
  const bests=()=>M.read(BEST)||{};
  function save(){ if(state) M.write(SAVE,state); }
  function setPick(){ M.write(PICK,{lang:chosenLang,mode:chosenMode}); }
  function buildRadio(container, options, selected, onPick){
    const buttons=options.map((o)=>{const b=document.createElement('button'); b.type='button'; b.className='choice-chip'; b.textContent=o.label; b.setAttribute('role','radio'); b.setAttribute('aria-checked',String(o.key===selected)); b.tabIndex=o.key===selected?0:-1; b.addEventListener('click',()=>onPick(o.key)); return b;});
    $(container).replaceChildren(...buttons);
  }
  function refreshPick(){
    buildRadio('language-list',Object.entries(G.LANGS).map(([key,v])=>({key,label:v.label})),chosenLang,(v)=>{chosenLang=v;setPick();refreshPick();});
    buildRadio('mode-list',Object.entries(G.MODES).map(([key,label])=>({key,label})),chosenMode,(v)=>{chosenMode=v;setPick();refreshPick();});
    $('daily-info').textContent=`${G.LANGS[chosenLang].label} · ${G.MODES[chosenMode]} · 같은 날짜 같은 문제 5개`;
    const s=bests()[key()]; $('pick-best').textContent=Number.isInteger(s)?`내 최고 ${s}/5`:'';
  }
  const startSetup=MaeilStart.setup({id:G.ID,difficulties:Object.entries(G.LEVELS).map(([key,v])=>({key,label:v.label,detail:v.detail})),defaultKey:'easy',bestText:(level)=>{const n=bests()[key(chosenLang,chosenMode,level)];return Number.isInteger(n)?`내 최고 ${n}/5`:'';},onStart:(level)=>start(false,level),onDaily:()=>start(true)});
  M.bindSettingButtons();
  function show(id){if('speechSynthesis'in window)speechSynthesis.cancel();for(const name of ['start-screen','game-screen','pause-screen','result-screen']) $(name).hidden=name!==id; window.scrollTo(0,0);}
  function start(daily=false,level=startSetup.selected){
    const date=daily?M.todayKey():null;
    state=G.create({lang:chosenLang,mode:chosenMode,level,daily:date}); paused=false;
    M.markPlayed(G.ID); save(); render(); show('game-screen');
  }
  function resume(){const saved=M.read(SAVE); if(!G.isValid(saved)) return false; state=saved; chosenLang=state.lang; chosenMode=state.mode; setPick(); refreshPick(); paused=false;render();show('game-screen');return true;}
  function backHome(){save();paused=false;refreshPick();show('start-screen');}
  function speak(){
    const item=bankItem(), lang=G.LANGS[state.lang]; if(!item) return;
    if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){$('audio-note').textContent='이 기기에서는 음성을 재생할 수 없어 글자로 안내합니다.';return;}
    const text=state.lang==='ko'?item.reading:item.word;
    const utterance=new SpeechSynthesisUtterance(text); utterance.lang=lang.locale; utterance.rate=.82;
    const voices=speechSynthesis.getVoices(); const voice=voices.find((v)=>v.lang.toLowerCase()===lang.locale.toLowerCase())||voices.find((v)=>v.lang.toLowerCase().startsWith(lang.locale.slice(0,2).toLowerCase())); if(voice) utterance.voice=voice;
    utterance.onerror=()=>{$('audio-note').textContent='발음 재생을 사용할 수 없어 글자로 확인해 주세요.';};
    $('audio-note').textContent=voice?'선택한 언어 음성으로 천천히 읽습니다.':'선택한 언어로 읽기를 요청했습니다. 음성 지원과 품질은 기기마다 달라요.';
    speechSynthesis.cancel(); speechSynthesis.speak(utterance);
  }
  function render(){
    if(!state)return;
    if(G.done(state)){finish();return;}
    const r=G.current(state), item=bankItem(r), lang=G.LANGS[state.lang]; if(!item)return;
    $('game-label').textContent=`${lang.label} · ${G.MODES[state.mode]}${state.daily?' · 오늘의 도전':''} · ${G.LEVELS[state.level].label}`;
    $('question-number').textContent=`${state.index+1}/${G.COUNT}`; $('correct-count').textContent=state.correct;
    $('lesson-hanzi').textContent=state.mode==='write'?item.char:item.hanzi; $('lesson-hanzi').lang=lang.script;
    $('lesson-word').textContent=state.mode==='write'?`${item.meaning} · ${lang.readingLabel}: ${item[state.lang]}`:(state.mode==='listen'?'':item.word===item.hanzi?'':item.reading);
    $('prompt-label').textContent=state.mode==='read'?`한자의 뜻을 고르세요 (${lang.label})`:state.mode==='listen'?`발음을 듣고 ${lang.readingLabel}을 고르세요`: '한자의 획순을 따라 써 보세요';
    $('speak-btn').hidden=state.mode==='write'; $('audio-note').textContent='';
    $('answer-list').hidden=state.mode==='write'; $('writing-area').hidden=state.mode!=='write'; $('answer-note').hidden=r.status==='playing'; $('answer-feedback').textContent=r.status==='playing'&&r.attempts.length?'틀렸어요. 다른 보기를 골라 보세요.':'';
    if(state.mode==='write') renderWriting(item,r); else renderOptions(item,r);
    if(r.status!=='playing') showAnswer(item,r);
    save();
  }
  function renderOptions(item,r){
    const list=$('answer-list'); const buttons=r.options.map((text,i)=>{const b=document.createElement('button');b.type='button';b.className='answer-choice';b.textContent=text;b.disabled=r.status!=='playing'||r.attempts.includes(i);if(r.status==='correct'&&text===(state.mode==='read'?item.meaning:item.reading))b.classList.add('is-correct');if(r.attempts.includes(i))b.classList.add('is-wrong');b.addEventListener('click',()=>{const result=G.answer(state,i);if(result==='correct')MaeilFx.play('match');else MaeilFx.play('miss');$('answer-feedback').textContent=result==='correct'?'맞았어요!':result==='wrong'?'다시 골라 보세요.':result==='revealed'?'남은 선택지가 없어 답을 확인했어요.':'';save();render();});return b;}); list.replaceChildren(...buttons);
  }
  const dOf=(pts)=>pts.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ');
  function renderWriting(item,r){
    const paths=$('stroke-paths'), active=$('active-stroke'); $('user-stroke').setAttribute('d','');
    $('write-target').textContent=item.char; paths.replaceChildren();
    const shownStroke=r.status==='revealed'?item.paths.length:r.stroke;
    item.paths.forEach((pts,i)=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',dOf(pts));p.setAttribute('class',`stroke-hint${i<shownStroke?' completed':r.guide==='all'||(r.guide==='current'&&i===r.stroke)?' visible':''}`);paths.append(p);});
    const target=r.status==='playing'?item.paths[r.stroke]:null; active.setAttribute('d',target?dOf(target):'');
    const start=$('stroke-start'); start.hidden=!target; if(target){start.setAttribute('cx',target[0][0]);start.setAttribute('cy',target[0][1]);}
    $('writing-instruction').textContent=r.status==='playing'?`${r.stroke+1}번째 획 · 노란 점에서 시작해 화살표 방향으로 쓰세요.`:r.status==='revealed'?'획순을 확인했어요.': '획순을 모두 썼어요!';
    $('show-stroke-btn').disabled=r.status!=='playing'; $('clear-stroke-btn').disabled=r.status!=='playing';
  }
  function showAnswer(item,r){
    const correct=r.status==='correct'; $('answer-note').hidden=false;
    $('answer-title').textContent=state.mode==='write'?`${item.char} · ${item.meaning}`:`${item.word} · ${item.reading}`;
    $('answer-detail').textContent=state.mode==='write'?(correct?`획순 ${item.paths.length}개를 따라 썼습니다.`:'획순을 확인하고 획 연습을 마쳤습니다.'):`뜻: ${item.meaning}　예: ${item.example}`;
    $('answer-feedback').textContent=correct?(state.mode==='write'?'잘 썼어요!':'정답이에요!'):'정답을 확인하고 다음 문제로 가세요.';
    $('next-btn').textContent=state.index===G.COUNT-1?'결과 보기':'다음 문제';
  }
  function finish(){
    const s=G.score(state), k=key(state.lang,state.mode,state.level), all=bests(), old=Number.isInteger(all[k])?all[k]:0; all[k]=Math.max(old,s.correct); M.write(BEST,all);
    if(state.daily) M.recordDaily(G.ID,state.daily);
    M.setSummary(G.ID,`최근 ${s.correct}/${G.COUNT} · ${G.LANGS[state.lang].label}`); M.write(SAVE,null);
    $('result-sub').textContent=`${G.LANGS[state.lang].label} · ${G.MODES[state.mode]}${state.daily?' · 오늘의 도전':''}`;
    $('result-score').textContent=`${s.correct}/${G.COUNT}`; $('result-detail').textContent=`다시 살펴볼 글자 ${s.revealed}개`;
    $('result-best').textContent=`내 최고 ${all[k]}/5`;
    $('review-list').replaceChildren(...state.rounds.map((r)=>{const item=G.itemFor(state,r),li=document.createElement('li');li.innerHTML=`<strong>${item.char||item.hanzi}</strong><span>${item.reading||item[state.lang]} · ${item.meaning}</span>`;return li;}));
    show('result-screen');
  }
  function next(){if(!G.next(state))return;save();render();}
  function svgPoint(event){const svg=$('writing-board'),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());return [v.x,v.y];}
  function nearestDistance(points,p){let best=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(den||1))),x=a[0]+t*dx,y=a[1]+t*dy;best=Math.min(best,Math.hypot(p[0]-x,p[1]-y));}return best;}
  function traceValid(points,target){
    if(points.length<3||Math.hypot(points[0][0]-target[0][0],points[0][1]-target[0][1])>24||Math.hypot(points.at(-1)[0]-target.at(-1)[0],points.at(-1)[1]-target.at(-1)[1])>24)return false;
    const path=$('active-stroke'),length=path.getTotalLength(); if(length<1)return false;
    for(let i=1;i<=8;i++){const at=path.getPointAtLength(length*i/9);if(nearestDistance(points,[at.x,at.y])>20)return false;}
    return true;
  }
  const board=$('writing-board');
  board.addEventListener('pointerdown',(e)=>{if(!state||state.mode!=='write'||G.current(state).status!=='playing')return;pointerId=e.pointerId;strokes=[svgPoint(e)];board.setPointerCapture(pointerId);$('user-stroke').setAttribute('d',dOf(strokes));});
  board.addEventListener('pointermove',(e)=>{if(e.pointerId!==pointerId)return;strokes.push(svgPoint(e));$('user-stroke').setAttribute('d',dOf(strokes));});
  function endStroke(e){if(e.pointerId!==pointerId)return;const pts=strokes;pointerId=null;strokes=[];const r=G.current(state),item=bankItem(r),target=item?.paths[r.stroke];if(target&&traceValid(pts,target)){const done=G.strokeDone(state);MaeilFx.play(done?'correct':'tap');$('answer-feedback').textContent=done?'잘 썼어요!':'좋아요, 다음 획을 써 보세요.';save();render();}else{$('user-stroke').setAttribute('d','');$('answer-feedback').textContent='획의 시작과 끝을 살펴 다시 써 보세요.';}}
  board.addEventListener('pointerup',endStroke); board.addEventListener('pointercancel',endStroke);
  $('clear-stroke-btn').addEventListener('click',()=>{$('user-stroke').setAttribute('d','');$('answer-feedback').textContent='다시 써 보세요.';});
  $('show-stroke-btn').addEventListener('click',()=>{if(G.reveal(state)){save();render();}});
  $('speak-btn').addEventListener('click',speak);
  $('next-btn').addEventListener('click',next);
  $('continue-btn').addEventListener('click',()=>resume());
  $('home-btn').addEventListener('click',backHome); $('pause-home-btn').addEventListener('click',backHome);
  $('pause-btn').addEventListener('click',()=>{paused=true;save();show('pause-screen');}); $('resume-btn').addEventListener('click',()=>{paused=false;show('game-screen');});
  $('again-btn').addEventListener('click',()=>start(false,startSetup.selected)); $('result-home-btn').addEventListener('click',backHome);
  $('share-btn').addEventListener('click',()=>M.share({title:'오늘의 한자 — 매일게임',text:G.shareText(state),url:M.pageUrl('hanja/')}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state&&!G.done(state)&&!$('game-screen').hidden){paused=true;save();show('pause-screen');}});
  const pick=loadPick(); if(G.LANGS[pick.lang])chosenLang=pick.lang;if(G.MODES[pick.mode])chosenMode=pick.mode;setPick();refreshPick();
  const saved=M.read(SAVE);if(G.isValid(saved)){chosenLang=saved.lang;chosenMode=saved.mode;refreshPick();$('continue-wrap').hidden=false;$('continue-info').textContent=`${G.LANGS[saved.lang].label} · ${G.MODES[saved.mode]} · ${saved.index+1}/${G.COUNT}`;}
  const doneToday=M.dailyDone(G.ID);startSetup.setDaily($('daily-info').textContent,doneToday);
  MaeilStart.handleDailyLink(()=>start(true));
})();
