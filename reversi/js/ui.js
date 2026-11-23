// 리버시 화면. 수를 선택한 뒤 다시 누르거나 [여기에 두기]로 확정한다.
// 탐색은 Worker에서 실행하고, 무르기·이동·숨김 시 요청을 취소한다.
(() => {
  const M = MaeilGame, G = Reversi, ID = 'reversi';
  const KEYS = { game: 'maeil-game.reversi.game.v1', stats: 'maeil-game.reversi.stats.v1' };
  const $ = (id) => document.getElementById(id);
  let game = null, picker, points = [], selected = -1, hinted = -1, cursor = 19;
  let thinking = false, worker = null, requestId = 0, computeTimer = 0;
  let clock = 0, finishTimer = 0, animationTimer = 0, changed = new Set(), finished = false;
  const label = (state) => state.daily ? `${M.dateLabel(state.daily)} 오늘의 도전` : `${G.DIFFICULTIES[state.difficulty].label} 난이도`;
  const coord = (index) => `${String.fromCharCode(65 + index % G.SIZE)}${Math.floor(index / G.SIZE) + 1}`;
  const loadStats = () => { const s = M.read(KEYS.stats); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; };
  const loadGame = () => { const s = M.read(KEYS.game); return G.isValid(s) && !s.over ? s : null; };
  const saveGame = () => { if (game && !game.over) M.write(KEYS.game, game); };
  const clearGame = () => { try { localStorage.removeItem(KEYS.game); } catch {} };
  const number = (value) => Number.isInteger(value) && value >= 0 ? value : 0;
  const recordText = (entry) => entry?.played ? `${number(entry.wins)}승 ${number(entry.draws)}무 ${Math.max(0, number(entry.played) - number(entry.wins) - number(entry.draws))}패` : '';

  function updateSummary() {
    const total = Object.values(loadStats()).reduce((s, e) => ({
      played: s.played + number(e?.played), wins: s.wins + number(e?.wins), draws: s.draws + number(e?.draws),
    }), { played: 0, wins: 0, draws: 0 });
    if (total.played) M.setSummary(ID, recordText(total));
  }

  function showScreen(id) {
    ['start-screen','game-screen','result-screen'].forEach((name) => { $(name).hidden = name !== id; });
    window.scrollTo(0, 0);
  }

  function cancelSearch() {
    requestId++;
    clearTimeout(computeTimer);
    if (worker) { worker.terminate(); worker = null; }
    thinking = false;
  }

  function stopClock() { clearInterval(clock); }
  function startClock() {
    stopClock();
    let last = performance.now();
    clock = setInterval(() => {
      const now = performance.now();
      if (game && !game.over && !document.hidden && !$('game-screen').hidden) game.elapsed += Math.max(0, now - last) / 1000;
      last = now;
    }, 1000);
  }

  function renderStart() {
    cancelSearch(); stopClock(); clearTimeout(finishTimer); clearTimeout(animationTimer); changed.clear();
    const today = M.todayKey(), done = M.dailyDone(ID, today);
    picker.setDaily(`${M.dateLabel(today)} · ${done ? '완료 ✓ 오늘의 대국에서 이겼어요' : '같은 첫 모양 · 보통 컴퓨터와 한 판'}`, done);
    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) {
      const c = G.counts(saved.board);
      $('continue-info').textContent = `${label(saved)} · 내 돌 ${c.black} : 컴퓨터 ${c.white}`;
    }
    picker.refresh(); showScreen('start-screen');
  }

  function buildBoard() {
    points = Array.from({ length: G.CELLS }, (_, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'rev-cell'; button.dataset.index = index;
      const disc = document.createElement('span'); disc.className = 'rev-disc'; disc.setAttribute('aria-hidden', 'true');
      button.append(disc);
      button.addEventListener('click', () => select(index));
      return button;
    });
    $('board').replaceChildren(...points);
  }

  function render() {
    if (!game) return;
    const c = G.counts(game.board);
    const legal = new Map((game.turn === G.BLACK && !game.over ? G.legalMoves(game.board, G.BLACK) : []).map((move) => [move.index, move]));
    points.forEach((button, index) => {
      const color = game.board[index];
      const classes = ['rev-cell'];
      if (color) classes.push(color === G.BLACK ? 'black' : 'white');
      if (legal.has(index) && !thinking) classes.push('legal');
      if (index === selected) classes.push('selected');
      if (index === hinted) classes.push('hint');
      if (index === game.lastMove) classes.push('last');
      if (changed.has(index)) classes.push('changed');
      button.className = classes.join(' ');
      button.tabIndex = index === cursor ? 0 : -1;
      button.setAttribute('aria-disabled', String(thinking || game.over || !legal.has(index)));
      const description = color ? (color === G.BLACK ? '내 흑돌' : '컴퓨터 백돌')
        : legal.has(index) ? `둘 수 있는 칸, ${legal.get(index).flips.length}개 뒤집기${index === selected ? ', 선택됨' : ''}${index === hinted ? ', 추천' : ''}` : '둘 수 없는 빈칸';
      button.setAttribute('aria-label', `${coord(index)}, ${description}`);
    });
    $('black-count').textContent = c.black;
    $('white-count').textContent = c.white;
    $('black-stat').classList.toggle('active', !game.over && game.turn === G.BLACK);
    $('white-stat').classList.toggle('active', !game.over && game.turn === G.WHITE);
    $('undo-btn').disabled = !G.canUndo(game);
    $('hint-btn').disabled = thinking || game.over || game.turn !== G.BLACK;
    $('clear-pick-btn').disabled = thinking || selected < 0 || game.over;
    $('place-btn').disabled = thinking || selected < 0 || game.over || game.turn !== G.BLACK;
    $('place-btn').textContent = selected >= 0 ? `${coord(selected)}에 두기` : '둘 곳을 선택하세요';
    const status = game.over ? (game.winner === G.BLACK ? '승리! 내 돌이 더 많아요' : game.winner === G.WHITE ? '대국이 끝났어요' : '같은 수로 무승부예요')
      : thinking ? (thinking === 'hint' ? '추천할 수를 살펴보고 있어요…'
        : `${game.lastPassed === G.BLACK ? '내가 둘 곳이 없어 차례를 넘겼어요. ' : ''}컴퓨터가 생각하는 중…`)
      : `${game.lastPassed ? (game.lastPassed === G.WHITE ? '컴퓨터가 둘 곳이 없어 차례를 넘겼어요. ' : '내가 둘 곳이 없어 차례를 넘겼어요. ') : ''}${game.turn === G.BLACK ? '내 차례 · 밝은 원을 선택하세요' : '컴퓨터 차례'}`;
    $('game-status').classList.toggle('thinking', Boolean(thinking));
    if ($('game-status').textContent !== status) $('game-status').textContent = status;
    $('move-detail').textContent = selected >= 0 && legal.has(selected)
      ? `${coord(selected)} · ${legal.get(selected).flips.length}개를 뒤집어요. 같은 칸을 다시 눌러도 놓을 수 있어요.`
      : game.over ? '돌이 더 많은 쪽이 이겨요.' : game.turn === G.BLACK ? `둘 수 있는 곳 ${legal.size}곳 · 선택한 뒤 놓아 보세요` : '무르기를 누르면 내 마지막 차례로 돌아가요';
  }

  function animate(previous) {
    clearTimeout(animationTimer);
    changed = new Set(game.board.map((value, index) => value !== previous[index] ? index : -1).filter((index) => index >= 0));
    animationTimer = setTimeout(() => { changed.clear(); if (!$('game-screen').hidden) render(); }, 280);
  }

  function start(state) {
    cancelSearch(); clearTimeout(finishTimer); clearTimeout(animationTimer); changed.clear();
    game = state; finished = false; selected = hinted = -1;
    cursor = G.legalMoves(game.board, G.BLACK)[0]?.index ?? 0;
    M.markPlayed(ID); saveGame(); buildBoard();
    $('game-label').textContent = `${label(game)} · 나는 흑돌로 먼저 둬요`;
    showScreen('game-screen'); render(); startClock();
    if (game.turn === G.WHITE) calculate('ai');
    else points[cursor].focus({ preventScroll: true });
  }

  function startDaily() {
    const today = M.todayKey(), saved = loadGame();
    start(saved && saved.daily === today ? saved : G.create(G.DAILY_DIFFICULTY, { daily: today }));
  }

  function select(index) {
    if (!game || game.over || thinking || game.turn !== G.BLACK) return;
    if (!G.flips(game.board, index, G.BLACK).length) { M.showToast('밝은 원이 있는 칸에 놓아 주세요'); return; }
    cursor = index;
    if (selected === index) { placeHere(); return; }
    selected = index; MaeilFx.play('tap'); render();
  }

  function placeHere() {
    if (!game || game.over || thinking || game.turn !== G.BLACK || selected < 0) return;
    const previous = game.board;
    if (!G.play(game, selected)) return;
    selected = hinted = -1;
    animate(previous); MaeilFx.play('stone'); saveGame(); render();
    if (game.over) endGame();
    else if (game.turn === G.WHITE) calculate('ai');
    else { cursor = G.legalMoves(game.board, G.BLACK)[0].index; render(); points[cursor].focus({ preventScroll: true }); }
  }

  function calculate(mode) {
    cancelSearch();
    if (!game || game.over || document.hidden || $('game-screen').hidden) return;
    thinking = mode; render();
    const id = requestId;
    const state = { board: game.board.slice(), turn: game.turn, over: false, difficulty: game.difficulty, rng: game.rng, moves: game.moves.slice() };
    const options = mode === 'hint' ? { depth: 3, nodes: 5000 } : {};
    const deliver = (move) => {
      if (id !== requestId || !game || game.over || document.hidden || $('game-screen').hidden) return;
      requestId++; // 중복 응답이나 늦게 도착한 오류도 이 요청을 다시 적용할 수 없다.
      if (worker) { worker.terminate(); worker = null; }
      thinking = false;
      const legal = G.legalMoves(game.board, game.turn);
      if (!legal.some((m) => m.index === move)) move = legal[0]?.index ?? -1;
      if (mode === 'hint') {
        if (move >= 0) { selected = hinted = cursor = move; game.hintsUsed++; saveGame(); MaeilFx.play('hint'); }
        render();
        if (move >= 0) points[move].focus({ preventScroll: true });
        return;
      }
      const previous = game.board;
      if (G.aiMove(game, move) < 0) { M.showToast('수를 계산하지 못했어요. 이어하기로 다시 열어 주세요'); render(); return; }
      animate(previous); MaeilFx.play('stone', { ai: true }); saveGame(); render();
      if (game.over) endGame();
      else if (game.turn === G.WHITE) calculate('ai'); // 내가 패스하면 컴퓨터가 연속으로 둔다.
      else {
        cursor = G.legalMoves(game.board, G.BLACK)[0].index;
        render(); points[cursor].focus({ preventScroll: true });
      }
    };
    const fallback = () => {
      if (id !== requestId) return;
      if (worker) { worker.terminate(); worker = null; }
      computeTimer = setTimeout(() => {
        if (id !== requestId || document.hidden || $('game-screen').hidden) return;
        deliver(G.chooseMove(state, { depth: mode === 'hint' ? 2 : Math.min(G.DIFFICULTIES[game.difficulty].depth, 3), nodes: 2500 }));
      }, 0);
    };
    computeTimer = setTimeout(() => {
      if (id !== requestId) return;
      try {
        if (typeof Worker !== 'function') { fallback(); return; }
        worker = new Worker('js/ai-worker.js');
        worker.onmessage = ({ data }) => {
          if (data.id !== id || id !== requestId) return;
          if (data.error) fallback(); else deliver(data.move);
        };
        worker.onerror = (event) => { event.preventDefault(); fallback(); };
        worker.postMessage({ id, state, options });
      } catch { fallback(); }
    }, mode === 'ai' ? 320 : 30);
  }

  function undo() {
    if (!game || !G.canUndo(game)) return;
    cancelSearch(); clearTimeout(animationTimer); changed.clear();
    G.undo(game); selected = hinted = -1;
    cursor = G.legalMoves(game.board, G.BLACK)[0]?.index ?? 0;
    saveGame(); MaeilFx.play('slide'); render(); points[cursor].focus({ preventScroll: true });
  }

  function endGame() {
    cancelSearch(); stopClock(); clearGame(); render();
    finishTimer = setTimeout(finish, 800);
  }

  function finish() {
    if (finished || !game || !game.over) return;
    finished = true; cancelSearch(); stopClock(); clearTimeout(finishTimer); clearGame();
    const c = G.counts(game.board), won = game.winner === G.BLACK, draw = game.winner === 0;
    const stats = loadStats(), key = game.daily ? 'daily' : game.difficulty, old = stats[key] || {};
    const previous = Number.isInteger(old.bestMargin) ? old.bestMargin : null;
    const isBest = won && (previous === null || c.black - c.white > previous);
    const entry = { played: number(old.played) + 1, wins: number(old.wins) + Number(won), draws: number(old.draws) + Number(draw) };
    if (won || previous !== null) entry.bestMargin = isBest ? c.black - c.white : previous;
    stats[key] = entry; M.write(KEYS.stats, stats);
    if (won && game.daily && !M.dailyDone(ID, game.daily)) M.recordDaily(ID, game.daily);
    updateSummary();
    $('result-title').textContent = won ? '승리했어요!' : draw ? '무승부예요' : '다음 한 판을 노려봐요';
    $('result-sub').textContent = label(game);
    $('result-score').textContent = `${c.black} : ${c.white}`;
    $('result-detail').textContent = `무르기 ${game.undoUsed}번 · 추천 ${game.hintsUsed}번 · ${M.formatTime(game.elapsed)}`;
    $('result-best').classList.toggle('new', isBest);
    $('result-best').textContent = `${recordText(entry)}${isBest ? ' · 새 최고 돌 차이!' : ''}`;
    $('result-daily').textContent = game.daily ? (won ? '오늘의 도전 완료 ✓' : '이기면 오늘의 도전 완료! 다시 도전해 보세요')
      : (won ? '모서리와 둘 수 있는 자리를 잘 지켰어요.' : '돌을 많이 뒤집는 수보다 모서리를 지키는 수를 찾아보세요.');
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '한 판 더';
    showScreen('result-screen'); MaeilFx.celebrate({ isBest, won });
    $('share-btn').focus({ preventScroll: true });
  }

  function onKey(event) {
    if ($('game-screen').hidden || !game || game.over || event.metaKey || event.ctrlKey || event.altKey
      || !event.target.closest?.('#board')) return;
    const offsets = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
    if (Object.prototype.hasOwnProperty.call(offsets, event.key)) {
      event.preventDefault();
      const offset = offsets[event.key], col = cursor % 8, next = cursor + offset;
      if (next < 0 || next >= 64 || (offset === -1 && col === 0) || (offset === 1 && col === 7)) return;
      cursor = next; render(); points[cursor].focus({ preventScroll: true });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) select(cursor);
    } else if (event.key === 'Escape') {
      selected = hinted = -1; render();
    }
  }

  function init() {
    M.bindSettingButtons();
    picker = MaeilStart.setup({ id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key,c]) => ({ key, label: c.label, detail: c.note })),
      bestText: (key) => recordText(loadStats()[key]), onStart: (key) => start(G.create(key)), onDaily: startDaily,
    });
    $('place-btn').addEventListener('click', placeHere);
    $('hint-btn').addEventListener('click', () => { if (game && !game.over && !thinking && game.turn === G.BLACK) calculate('hint'); });
    $('undo-btn').addEventListener('click', undo);
    $('clear-pick-btn').addEventListener('click', () => { selected = hinted = -1; render(); });
    $('continue-btn').addEventListener('click', () => { const saved = loadGame(); if (saved) start(saved); else renderStart(); });
    $('home-btn').addEventListener('click', () => { if (game?.over) finish(); else { saveGame(); renderStart(); } });
    $('again-btn').addEventListener('click', () => game.daily ? startDaily() : start(G.create(game.difficulty)));
    $('result-home-btn').addEventListener('click', renderStart);
    $('share-btn').addEventListener('click', () => {
      const c = G.counts(game.board);
      M.share({ title: '리버시 — 매일게임', text: `[매일게임 리버시] ${label(game)} · 흑 ${c.black} : 백 ${c.white} · ${game.winner === G.BLACK ? '승리!' : game.winner === 0 ? '무승부' : '다시 도전!'}\n무르기 ${game.undoUsed}번 · 추천 ${game.hintsUsed}번`, url: M.pageUrl('reversi/') });
    });
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (game?.over && !$('game-screen').hidden) finish(); cancelSearch(); stopClock(); saveGame(); }
      else if (game && !game.over && !$('game-screen').hidden) { startClock(); render(); if (game.turn === G.WHITE) calculate('ai'); }
    });
    window.addEventListener('pagehide', () => { if (game?.over && !$('game-screen').hidden) finish(); cancelSearch(); stopClock(); saveGame(); });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && game && !game.over && !$('game-screen').hidden) { startClock(); render(); if (game.turn === G.WHITE) calculate('ai'); }
    });
    renderStart(); updateSummary(); MaeilStart.handleDailyLink(startDaily); M.registerOffline('../');
  }
  init();
})();
