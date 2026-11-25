// 오목 화면·조작·저장. 규칙과 컴퓨터는 logic.js.
// 잘못 누르는 일을 막기 위해: 칸을 누르면 흐린 돌(미리보기) → 같은 칸을 한 번 더 누르거나 [여기에 두기]로 놓는다.
(() => {
  const M = MaeilGame;
  const G = Omok;
  const ID = 'omok';
  const KEYS = { game: 'maeil-game.omok.game.v1', stats: 'maeil-game.omok.stats.v1' };
  const AI_DELAY = 120;
  const $ = (id) => document.getElementById(id);
  let game = null,worker=null,requestId=0,watchdog=0,offered=null,suspended=false;
  let picker;
  let points = [];
  let ghost = -1;
  let cursor = Math.floor(G.CELLS / 2);
  let thinking = false;
  let aiTimer = 0;
  let clock = 0;
  let finished = false, resultPresented = false;
  let explanation = null, review = null;

  const resultReason = () => G.explainWin(game)?.text || (explanation
    ? `${explanation.text} — ${game.winner === G.BLACK ? '컴퓨터 기권 · 내 승리' : '기권 · 내 패배'}`
    : game.reason === 'resign' ? `${game.outcomeText || '승부가 확정됐어요'} — ${game.winner === G.BLACK ? '컴퓨터 기권 · 내 승리' : '기권 · 내 패배'}`
    : '서로 다섯을 만들 수 없어 무승부예요');

  function beginReview(kind) {
    if (kind === 'proof' && !explanation?.steps.length) return;
    review = { kind, count: 0 };
    showScreen('game-screen');render();$('replay-next').focus({preventScroll:true});
  }
  function closeReview() {
    review = null;render();
    (offered ? $('outcome-continue') : game.over ? $('view-result') : $('view-proof')).focus();
  }

  const loadStats = () => { const s = M.read(KEYS.stats); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; };
  const loadGame = () => { const s = M.read(KEYS.game); return s&&!s.over?G.restore(s):null; };
  const saveGame = () => { if (game && !game.over) M.write(KEYS.game, game); };
  const clearGame = () => { try { localStorage.removeItem(KEYS.game); } catch {} };
  const label = (s) => (s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : `${G.DIFFICULTIES[s.difficulty].label} 난이도`);
  const coord = (i) => `${Math.floor(i / G.SIZE) + 1}행 ${(i % G.SIZE) + 1}열`;

  function bestText(key) {
    const s = loadStats()[key];
    return s?.bestMoves ? `내 최고 ${s.bestMoves}수 만에 승리 · ${s.wins}승` : (s?.played ? `${s.wins || 0}승 ${s.played - (s.wins || 0) - (s.draws || 0)}패${s.draws?' '+s.draws+'무':''}` : '');
  }

  function updateSummary() {
    const all = Object.values(loadStats()).map((s) => s?.bestMoves).filter(Number.isFinite);
    if (all.length) M.setSummary(ID, `최고 ${Math.min(...all)}수 만에 승리`);
  }

  function showScreen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function renderStart() {
    stopClock();
    cancelSearch();
    thinking = false;
    const today = M.todayKey();
    const done = M.dailyDone(ID, today);
    picker.setDaily(`${M.dateLabel(today)} · ${done ? '완료 ✓ 오늘의 대국에서 이겼어요' : '같은 첫 모양 · 보통 컴퓨터를 이겨 보세요'}`, done);
    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    if (saved) $('continue-info').textContent = `${label(saved)} · ${G.playerMoves(saved)}수째`;
    picker.refresh();
    showScreen('start-screen');
  }

  // ---------- 판 ----------
  function buildBoard() {
    const stars = new Set([3, 6, 9].flatMap((r) => [3, 6, 9].map((c) => r * G.SIZE + c)));
    points = Array.from({ length: G.CELLS }, (_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.i = i;
      b.setAttribute('role', 'gridcell');
      b.tabIndex = -1;
      if (stars.has(i)) b.append(Object.assign(document.createElement('span'), { className: 'star' }));
      b.append(Object.assign(document.createElement('span'), { className: 'stone' }));
      b.append(Object.assign(document.createElement('span'), { className: 'point-mark' }));
      return b;
    });
    const track = Object.assign(document.createElement('div'), {className:'win-track'});
    track.setAttribute('aria-hidden','true');
    $('board').replaceChildren(...points,track);
  }

  function render() {
    const steps = review?.kind === 'proof' ? explanation.steps : [];
    const board = review?.kind === 'history' ? G.replayBoard(game, review.count) : game.board.slice();
    steps.slice(0,review?.count || 0).forEach(s=>board[s.idx]=s.color);
    const last = review ? (review.kind === 'history' ? game.moves[review.count-1] : steps[review.count-1]?.idx) : G.lastMove(game);
    const line = review ? (last === undefined ? null : G.winLine(board,last)) : game.line;
    const win = new Set(line || []);
    const marks = review ? (review.kind === 'proof' ? (review.count ? G.threatMarks(board,explanation.color) : explanation) : {}) : explanation || {};
    if(review?.kind === 'proof' && review.count && steps[review.count]?.color === explanation.color) marks.next = [steps[review.count].idx];
    const threats = new Set(marks.stones || []), blocks = new Set(marks.blocks || []), next = new Set(marks.next || []);
    const numbers = new Map(steps.slice(0,review?.count || 0).map((s,n)=>[s.idx,n+1]));
    points.forEach((b, i) => {
      const v = board[i];
      let cls = `omok-pt c${i % G.SIZE} r${Math.floor(i / G.SIZE)}`;
      if (v === G.BLACK) cls += ' black';
      else if (v === G.WHITE) cls += ' white';
      else if (i === ghost) cls += ' ghost';
      if (i === last) cls += ' last';
      if (win.has(i)) cls += ' win';
      if (threats.has(i)) cls += ' threat';
      if (!v && blocks.has(i)) cls += ' block-point';
      if (!v && next.has(i)) cls += ' next-point';
      if (b.dataset.cls !== cls) { b.className = cls; b.dataset.cls = cls; }
      b.tabIndex = i === cursor ? 0 : -1;
      const what = v === G.BLACK ? '흑돌(나)' : v === G.WHITE ? '백돌(컴퓨터)' : i === ghost ? '미리보기, 한 번 더 누르면 놓기' : '빈칸';
      b.children[b.children.length-1].textContent = numbers.get(i) || (!v && blocks.has(i) ? '×' : !v && next.has(i) ? '◇' : '');
      b.setAttribute('aria-label', `${coord(i)} ${what}${i===last?', 마지막 수':''}${win.has(i)?', 이긴 줄':''}${threats.has(i)?', 위협 돌':''}${!v&&blocks.has(i)?', 지금 막을 곳':''}${!v&&next.has(i)?', 다음 공격 자리':''}${numbers.has(i)?', 수순 '+numbers.get(i):''}`);
    });
    $('move-count').textContent = G.playerMoves(game);
    $('undo-count').textContent = game.undoLeft;
    $('undo-btn').disabled = thinking || !G.canUndo(game);
    $('place-btn').disabled = thinking || Boolean(offered) || suspended || game.over || Boolean(review) || ghost < 0;
    $('place-btn').hidden = game.over || Boolean(offered) || Boolean(review);
    $('play-help').hidden = game.over || Boolean(offered) || Boolean(review);
    $('undo-btn').disabled ||= Boolean(offered)||suspended||Boolean(review);
    $('home-btn').disabled=Boolean(offered);
    points.forEach(b=>{b.disabled=thinking||Boolean(offered)||suspended||game.over||Boolean(review);});
    $('board').inert=suspended;
    $('outcome-notice').textContent = review?.kind==='history' ? '처음부터 실제로 둔 수를 돌아봅니다' : game.over ? resultReason() : explanation ? `${game.outcomeText} · ${explanation.text}` : game.outcomeText || '';
    $('board-legend').hidden = !game.over && !explanation && !review;
    $('view-result').hidden = !game.over || Boolean(review);
    $('view-proof').hidden = !explanation?.steps.length || (!offered && !game.over) || Boolean(review);
    $('outcome-overlay').hidden = !offered || Boolean(review);
    $('replay-controls').hidden = !review;
    if(review){
      const total = review.kind==='history'?game.moves.length:steps.length;
      $('replay-prev').disabled=review.count===0;$('replay-next').disabled=review.count===total;
      $('replay-status').textContent=review.kind==='history'
        ? `${review.count} / ${total}수 · ${review.count===0?(game.opening.length?'미리 놓인 첫 모양':'빈 판'):`${review.count%2?'흑(나)':'백(컴퓨터)'} · ${coord(last)}`}`
        : `${review.count} / ${total}수 · ${review.count?`${steps[review.count-1].color===G.BLACK?'흑':'백'} · ${coord(last)}`:'지금 판'} · 상대가 한쪽을 막는 예시 수순입니다`;
    }
    drawWinLine(line);
    const status = $('game-status');
    status.classList.toggle('thinking', thinking);
    status.textContent = review ? (review.kind==='history'?'수순 다시 보기':'승리 수순 보기') : offered ? '판 위 위협을 보고 선택해 주세요' : game.over
      ? (game.reason==='resign'?(game.winner===G.BLACK?'컴퓨터가 기권했어요 · 흑 승리':'기권 · 백 승리'):game.winner === G.BLACK ? '다섯 개를 이었어요! 승리!' : game.winner === G.WHITE ? '컴퓨터가 다섯 개를 이었어요' : '서로 다섯을 만들 수 없어 무승부예요')
      : thinking ? '컴퓨터가 생각하는 중…' : ghost >= 0 ? '이 자리에 둘까요? 한 번 더 누르세요' : '내 차례(흑) — 둘 곳을 누르세요';
  }

  function drawWinLine(line) {
    // Endpoint positions are relative to grid cells, so resizing needs no measurements.
    if(!line?.length){$('board').style.setProperty('--win-width','0px');return;}
    const a=line[0],b=line.at(-1),dx=b%G.SIZE-a%G.SIZE,dy=Math.floor(b/G.SIZE)-Math.floor(a/G.SIZE);
    $('board').style.setProperty('--win-x',`${(a%G.SIZE+.5)/G.SIZE*100}%`);
    $('board').style.setProperty('--win-y',`${(Math.floor(a/G.SIZE)+.5)/G.SIZE*100}%`);
    $('board').style.setProperty('--win-width',`${Math.hypot(dx,dy)/G.SIZE*100}%`);
    $('board').style.setProperty('--win-angle',`${Math.atan2(dy,dx)}rad`);
  }

  function drop(i) {
    const b = points[i];
    if (b) MaeilFx.pulse(b, 'drop', 200);
  }

  // ---------- 진행 ----------
  function start(state) {
    cancelSearch();stopClock();offered=null;suspended=false;$('outcome-overlay').hidden=true;
    game = state;
    explanation=null;review=null;
    finished = false;resultPresented=false;
    ghost = -1;
    thinking = false;
    cursor = Math.floor(G.CELLS / 2);
    M.markPlayed(ID);
    saveGame();
    buildBoard();
    $('game-label').textContent = label(game);
    showScreen('game-screen');
    startClock();
    // 저장된 판이 컴퓨터 차례에서 멈췄으면 이어서 둔다
    if(game.over){endGame();return;}
    if (game.moves.length % 2 === 1) aiTurn();
    else if(game.moves.length||game.opening.length)aiTurn('assess');
    render();
  }

  function startDaily() {
    const today = M.todayKey();
    const saved = loadGame();
    start(saved && saved.daily === today ? saved : G.create(G.DAILY_DIFFICULTY, { daily: today }));
  }

  function startClock() {
    stopClock();
    let last = performance.now();
    clock = setInterval(() => {
      const now = performance.now();
      if (game && !game.over && !document.hidden) game.elapsed += (now - last) / 1000;
      last = now;
    }, 1000);
  }
  function stopClock() { clearInterval(clock); }

  function tapPoint(i) {
    if (!game || game.over || thinking || offered || suspended || review || game.board[i] !== 0) {
      if (game && !game.over && !thinking && game.board[i] !== 0) MaeilFx.play('error');
      return;
    }
    cursor = i;
    if (ghost === i) { placeHere(); return; }
    ghost = i;
    MaeilFx.play('tap');
    render();
  }

  function placeHere() {
    if (thinking||offered||suspended||review||ghost < 0 || !G.play(game, ghost)) return;
    explanation=null;
    const i = ghost;
    ghost = -1;
    MaeilFx.play('stone');
    render();
    drop(i);
    saveGame();
    if (game.over) return endGame();
    aiTurn();
  }

  function cancelSearch(){requestId++;clearTimeout(aiTimer);clearTimeout(watchdog);worker?.terminate();worker=null;thinking=false;}
  function offer(report){
    const d=G.decision(game,report);if(!d)return false;
    explanation=d.explanation||null;
    game.outcomeText=d.text;saveGame();
    if(d.winner===G.BLACK){G.resign(game,G.WHITE);endGame();return true;}
    if(game.continueDecided){render();return false;}
    offered=d;stopClock();$('outcome-title').textContent=d.text;$('outcome-detail').textContent=explanation?.text||d.text;render();$('outcome-continue').focus({preventScroll:true});return true;
  }
  function aiTurn(mode='ai') {
    if(!game||game.over||offered||suspended)return;
    cancelSearch();const id=requestId,copy=JSON.parse(JSON.stringify(game));thinking=true;render();
    const options=mode==='assess'?{assessOnly:true,timeMs:350}:{};
    function deliver(data){
      if(id!==requestId||suspended||finished||$('game-screen').hidden)return;
      clearTimeout(watchdog);worker?.terminate();worker=null;thinking=false;requestId++;
      if(offer(data.report))return;
      if(mode==='assess'){saveGame();render();return;}
      let i=data.move;
      if(!Number.isInteger(i)||i<0||i>=G.CELLS||game.board[i])i=G.chooseMove({...game,difficulty:'easy'});
      if(Number.isInteger(data.rng))game.rng=data.rng;
      i=G.commitAI(game,i);
      explanation=null;
      if(i>=0){MaeilFx.play('stone',{ai:true});cursor=i;drop(i);}
      render();saveGame();
      if(game.over)endGame();else aiTurn('assess');
    }
    function fallback(){
      if(id!==requestId)return;clearTimeout(watchdog);worker?.terminate();worker=null;
      aiTimer=setTimeout(()=>{
        if(id!==requestId||suspended)return;
        const report=G.analyze(copy,{...options,depth:1,nodes:250,timeMs:60,proofDepth:4});
        const move=copy.difficulty==='easy'?G.chooseMove(copy):report.move;
        deliver({move,report,rng:copy.rng});
      },0);
    }
    aiTimer=setTimeout(()=>{
      if(id!==requestId||suspended)return;
      try{
        if(typeof Worker!=='function'){fallback();return;}
        worker=new Worker('js/ai-worker.js');
        worker.onmessage=({data})=>{if(data.id!==id||id!==requestId)return;data.error?fallback():deliver(data);};
        worker.onerror=e=>{e.preventDefault();fallback();};
        watchdog=setTimeout(fallback,2600);worker.postMessage({id,state:copy,options});
      }catch{fallback();}
    },mode==='assess'?0:AI_DELAY);
  }

  function endGame() {
    cancelSearch();stopClock();clearGame();
    render();
    if (game.winner === G.BLACK) { MaeilFx.buzz(25); }
    else if (game.winner === G.WHITE) { MaeilFx.play('miss'); MaeilFx.buzz([30, 40, 30]); }
    // Record once now, then let the player inspect the board at their own pace.
    finish(false);
    $('view-result').focus({preventScroll:true});
  }

  function undo() {
    if (offered||suspended||thinking||review || !G.undo(game)) return;
    explanation=null;
    ghost = -1;
    MaeilFx.play('slide');
    saveGame();
    render();
  }

  function finish(show = true) {
    if (!game || !game.over) return;
    if(finished){if(show)presentResult();return;}
    finished = true;
    stopClock();
    const won = game.winner === G.BLACK;
    const moves = G.playerMoves(game);
    const key = game.daily ? 'daily' : game.difficulty;
    const stats = loadStats();
    const e = stats[key] || {};
    const prevBest = Number.isFinite(e.bestMoves) ? e.bestMoves : null;
    const isBest = won && (prevBest === null || moves < prevBest);
    stats[key] = {
      played: (e.played || 0) + 1,
      wins: (e.wins || 0) + (won ? 1 : 0),
      draws: (e.draws || 0) + Number(game.winner===0),
      bestMoves: isBest ? moves : prevBest,
    };
    if (stats[key].bestMoves === null) delete stats[key].bestMoves;
    M.write(KEYS.stats, stats);
    if (won && game.daily && !M.dailyDone(ID, game.daily)) M.recordDaily(ID, game.daily);
    updateSummary();

    $('result-title').textContent = won ? '승리했어요!' : game.winner === G.WHITE ? '아깝게 졌어요' : '무승부';
    $('result-reason').textContent = resultReason();
    $('result-sub').textContent = `${label(game)}${game.reason==='resign'?(won?' · 컴퓨터 기권':' · 기권'):''}${game.outcomeText?' · '+game.outcomeText:''}`;
    $('result-score').textContent = won ? `${moves}수` : '-';
    $('result-detail').textContent = `내가 둔 수 ${moves} · ${M.formatTime(game.elapsed)}`;
    $('result-best').textContent = isBest
      ? (prevBest ? `새 최고 기록! 이전 ${prevBest}수` : '첫 승리 기록이 저장됐어요!')
      : `${stats[key].wins}승 ${stats[key].played - stats[key].wins - stats[key].draws}패${stats[key].draws?' '+stats[key].draws+'무':''}${prevBest ? ` · 최고 ${prevBest}수 만에 승리` : ''}`;
    $('result-best').classList.toggle('new', isBest);
    $('result-daily').textContent = game.daily
      ? (won ? '오늘의 도전 완료 ✓ 출석을 남겼어요' : '이기면 오늘의 도전 완료! 다시 도전해 보세요')
      : (won ? '적은 수로 이길수록 좋은 기록이에요' : '상대의 열린 셋(양쪽이 빈 세 알)을 먼저 막아 보세요');
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '한 판 더';
    if(show)presentResult();
  }

  function presentResult() {
    showScreen('result-screen');
    if(!resultPresented){
      resultPresented=true;
      const won=game.winner===G.BLACK;
      if(won)MaeilFx.countUp($('result-score'),G.playerMoves(game),(n)=>`${n}수`,500);
      MaeilFx.celebrate({isBest:$('result-best').classList.contains('new'),won});
    }
    $('review-board').focus({preventScroll:true});
  }

  // 키보드: 방향키로 칸 이동, Enter·스페이스로 미리보기/두기
  function onKey(event) {
    if ($('game-screen').hidden || !game || game.over ||offered||suspended||review) return;
    const step = { ArrowUp: -G.SIZE, ArrowDown: G.SIZE, ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step !== undefined) {
      event.preventDefault();
      const x = cursor % G.SIZE;
      if ((step === -1 && x === 0) || (step === 1 && x === G.SIZE - 1)) return;
      const next = cursor + step;
      if (next < 0 || next >= G.CELLS) return;
      cursor = next;
      render();
      points[cursor].focus({ preventScroll: true });
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (event.target.closest && event.target.closest('#board')) {
        event.preventDefault();
        tapPoint(cursor);
      }
    }
  }

  function init() {
    M.bindSettingButtons();
    picker = MaeilStart.setup({
      id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: c.note })),
      bestText,
      onStart: (key) => start(G.create(key)),
      onDaily: startDaily,
    });
    $('board').addEventListener('click', (event) => {
      const b = event.target.closest('.omok-pt');
      if (b) tapPoint(Number(b.dataset.i));
    });
    document.addEventListener('keydown', onKey);
    $('outcome-continue').addEventListener('click',()=>{if(!offered)return;offered=null;game.continueDecided=true;$('outcome-overlay').hidden=true;saveGame();render();startClock();if(game.moves.length%2)aiTurn();});
    $('outcome-new').addEventListener('click',()=>{if(!offered)return;offered=null;$('outcome-overlay').hidden=true;G.resign(game,G.BLACK);endGame();finish();start(G.create(game.difficulty,game.daily?{daily:game.daily}:{}));});
    $('place-btn').addEventListener('click', placeHere);
    $('view-result').addEventListener('click',()=>finish());
    $('review-board').addEventListener('click',()=>{review=null;showScreen('game-screen');render();$('view-result').focus();});
    $('review-game').addEventListener('click',()=>beginReview('history'));
    $('view-proof').addEventListener('click',()=>beginReview('proof'));
    $('replay-close').addEventListener('click',closeReview);
    for(const [id,delta] of [['replay-prev',-1],['replay-next',1]])$(id).addEventListener('click',()=>{if(!review)return;const total=review.kind==='history'?game.moves.length:explanation.steps.length;review.count=Math.max(0,Math.min(total,review.count+delta));render();});
    $('undo-btn').addEventListener('click', undo);
    $('continue-btn').addEventListener('click', () => { const s = loadGame(); if (s) start(s); else renderStart(); });
    $('home-btn').addEventListener('click', () => {
      if (game?.over) { review=null; finish(); return; }
      saveGame();
      renderStart();
    });
    $('again-btn').addEventListener('click', () => (game.daily ? startDaily() : start(G.create(game.difficulty))));
    $('result-home-btn').addEventListener('click', renderStart);
    $('share-btn').addEventListener('click', () => {
      const won = game.winner === G.BLACK;
      M.share({
        title: '오목 — 매일게임',
        text: `[매일게임 오목] ${label(game)} · ${won ? `${G.playerMoves(game)}수 만에 승리!` : '컴퓨터에게 졌어요. 이겨 볼 사람?'}`,
        url: M.pageUrl('omok/'),
      });
    });
    function suspend(){if(!game||$('game-screen').hidden)return;if(game.over)return;suspended=true;cancelSearch();stopClock();saveGame();render();}
    function wake(){if(!game||!suspended||$('game-screen').hidden||finished)return;suspended=false;render();if(!offered){startClock();aiTurn(game.moves.length%2?'ai':'assess');}}
    document.addEventListener('visibilitychange',()=>document.hidden?suspend():wake());
    window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',wake);
    renderStart();
    updateSummary();
    MaeilStart.handleDailyLink(startDaily);
    M.registerOffline('../');
  }

  init();
})();
