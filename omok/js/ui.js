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
  let finishTimer = 0;
  let finished = false;

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
    clearTimeout(finishTimer);
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
      return b;
    });
    $('board').replaceChildren(...points);
  }

  function render() {
    const last = G.lastMove(game);
    const win = new Set(game.line || []);
    points.forEach((b, i) => {
      const v = game.board[i];
      let cls = `omok-pt c${i % G.SIZE} r${Math.floor(i / G.SIZE)}`;
      if (v === G.BLACK) cls += ' black';
      else if (v === G.WHITE) cls += ' white';
      else if (i === ghost) cls += ' ghost';
      if (i === last) cls += ' last';
      if (win.has(i)) cls += ' win';
      if (b.dataset.cls !== cls) { b.className = cls; b.dataset.cls = cls; }
      b.tabIndex = i === cursor ? 0 : -1;
      const what = v === G.BLACK ? '흑돌(나)' : v === G.WHITE ? '백돌(컴퓨터)' : i === ghost ? '미리보기, 한 번 더 누르면 놓기' : '빈칸';
      b.setAttribute('aria-label', `${coord(i)} ${what}`);
    });
    $('move-count').textContent = G.playerMoves(game);
    $('undo-count').textContent = game.undoLeft;
    $('undo-btn').disabled = thinking || !G.canUndo(game);
    $('place-btn').disabled = thinking || Boolean(offered) || suspended || game.over || ghost < 0;
    $('undo-btn').disabled ||= Boolean(offered)||suspended;
    $('home-btn').disabled=Boolean(offered);
    points.forEach(b=>{b.disabled=thinking||Boolean(offered)||suspended||game.over;});
    $('board').inert=Boolean(offered)||suspended;
    $('outcome-notice').textContent=game.outcomeText||'';
    const status = $('game-status');
    status.classList.toggle('thinking', thinking);
    status.textContent = game.over
      ? (game.reason==='resign'?(game.winner===G.BLACK?'컴퓨터가 기권했어요 · 흑 승리':'기권 · 백 승리'):game.winner === G.BLACK ? '다섯 개를 이었어요! 승리!' : game.winner === G.WHITE ? '컴퓨터가 다섯 개를 이었어요' : '서로 다섯을 만들 수 없어 무승부예요')
      : thinking ? '컴퓨터가 생각하는 중…' : ghost >= 0 ? '이 자리에 둘까요? 한 번 더 누르세요' : '내 차례(흑) — 둘 곳을 누르세요';
  }

  function drop(i) {
    const b = points[i];
    if (b) MaeilFx.pulse(b, 'drop', 200);
  }

  // ---------- 진행 ----------
  function start(state) {
    cancelSearch();stopClock();offered=null;suspended=false;$('outcome-overlay').hidden=true;
    clearTimeout(finishTimer);
    game = state;
    finished = false;
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
    if (!game || game.over || thinking || offered || suspended || game.board[i] !== 0) {
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
    if (thinking||offered||suspended||ghost < 0 || !G.play(game, ghost)) return;
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
    game.outcomeText=d.text;saveGame();
    if(d.winner===G.BLACK){G.resign(game,G.WHITE);endGame();return true;}
    if(game.continueDecided){render();return false;}
    offered=d;stopClock();$('outcome-title').textContent=d.text;$('outcome-overlay').hidden=false;render();$('outcome-continue').focus();return true;
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
    // 이어진 다섯 알을 잠깐 보여 준 뒤 결과 화면
    finishTimer = setTimeout(finish, game.line ? 1600 : 700);
  }

  function undo() {
    if (offered||suspended||thinking || !G.undo(game)) return;
    ghost = -1;
    MaeilFx.play('slide');
    saveGame();
    render();
  }

  function finish() {
    if (finished || !game || !game.over) return;
    finished = true;
    clearTimeout(finishTimer);
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
    showScreen('result-screen');
    if (won) MaeilFx.countUp($('result-score'), moves, (n) => `${n}수`, 500);
    MaeilFx.celebrate({ isBest, won });
    $('share-btn').focus({ preventScroll: true });
  }

  // 키보드: 방향키로 칸 이동, Enter·스페이스로 미리보기/두기
  function onKey(event) {
    if ($('game-screen').hidden || !game || game.over ||offered||suspended) return;
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
    $('undo-btn').addEventListener('click', undo);
    $('continue-btn').addEventListener('click', () => { const s = loadGame(); if (s) start(s); else renderStart(); });
    $('home-btn').addEventListener('click', () => {
      if (game?.over) { finish(); return; }
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
    function suspend(){if(!game||$('game-screen').hidden)return;if(game.over){finish();return;}suspended=true;cancelSearch();stopClock();saveGame();render();}
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
