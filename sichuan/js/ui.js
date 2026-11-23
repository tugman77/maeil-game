// 시작·선택·경로 표시·저장·기록. 게임 규칙과 배치 생성은 logic.js에서 처리한다.
(() => {
  const M = MaeilGame, G = SichuanGame, ID = 'sichuan';
  const KEYS = { game: 'maeil-game.sichuan.game.v1', stats: 'maeil-game.sichuan.stats.v1', daily: 'maeil-game.sichuan.daily.v1' };
  const $ = (id) => document.getElementById(id);
  let game = null, picker, cells = [], selected = -1, focusIndex = 0;
  let paused = false, finished = false, blocked = false, visual = null;
  let animation = 0, timer = 0, lastTick = 0, ticks = 0;

  function stats() {
    const value = M.read(KEYS.stats);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }
  function loadGame() {
    const saved = M.read(KEYS.game);
    return G.isValid(saved) && !G.isDone(saved) ? saved : null;
  }
  const save = () => { if (game && !finished && !G.isDone(game)) M.write(KEYS.game, game); };
  const clearSave = () => { try { localStorage.removeItem(KEYS.game); } catch {} };
  const label = (s) => s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : `${G.DIFFICULTIES[s.difficulty].label} · ${s.rows}×${s.cols}`;
  const seconds = (s) => Math.floor(s.elapsed);
  function summary() {
    const data = stats();
    const key = Object.keys(G.DIFFICULTIES).filter((k) => Number.isFinite(data[k]?.best))
      .sort((a, b) => (data[b].played || 0) - (data[a].played || 0))[0];
    if (key) M.setSummary(ID, `최고 ${M.formatTime(data[key].best)} (${G.DIFFICULTIES[key].label})`);
  }
  function screen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((key) => { $(key).hidden = id !== key; });
    window.scrollTo(0, 0);
  }
  function message(text) { $('game-status').textContent = text; }
  function renderStart() {
    stopTimer(); settle();
    const today = M.todayKey(), result = M.read(KEYS.daily);
    const done = M.dailyDone(ID, today);
    picker.setDaily(done && result?.date === today
      ? `${M.dateLabel(today)} · 완료 ${M.formatTime(result.seconds)}`
      : `${M.dateLabel(today)} · 같은 패 배치 · 24쌍`, done);
    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) $('continue-info').textContent = `${label(saved)} · ${G.remaining(saved)}쌍 남음`;
    picker.refresh(); screen('start-screen');
  }
  function start(state) {
    stopTimer(); settle();
    game = state; paused = false; finished = false; selected = -1;
    focusIndex = game.board.findIndex(Boolean);
    M.markPlayed(ID); save(); buildBoard();
    $('pause-overlay').hidden = true;
    screen('game-screen'); updateBlocked(); render();
    if (game.started) startTimer();
    $('pause-btn').focus();
  }
  function startDaily() {
    const today = M.todayKey(), saved = loadGame();
    start(saved?.daily === today ? saved : G.create(G.DAILY_DIFFICULTY, { daily: today, random: M.dailyRandom(ID, today) }));
  }
  function buildBoard() {
    $('board').style.setProperty('--cols', game.cols);
    cells = game.board.map((_, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tile'; button.dataset.index = index;
      button.addEventListener('click', () => choose(index));
      return button;
    });
    $('board').replaceChildren(...cells);
  }
  function render() {
    game.board.forEach((value, i) => {
      const removing = visual?.removing && (visual.a === i || visual.b === i);
      const shown = value || (removing ? visual.value : 0);
      const el = cells[i];
      el.textContent = shown ? G.SYMBOLS[shown - 1][0] : '';
      el.classList.toggle('empty', !shown);
      el.classList.toggle('selected', selected === i && Boolean(value));
      el.classList.toggle('hint', Boolean(visual && !visual.removing && (visual.a === i || visual.b === i)));
      el.classList.toggle('removing', Boolean(removing));
      el.disabled = !value || paused || Boolean(animation);
      el.tabIndex = i === focusIndex && value ? 0 : -1;
      el.setAttribute('aria-pressed', String(selected === i && Boolean(value)));
      el.setAttribute('aria-label', `${Math.floor(i / game.cols) + 1}행 ${i % game.cols + 1}열, ${value ? G.SYMBOLS[value - 1][1] : '빈자리'}`);
    });
    $('remaining').textContent = G.remaining(game);
    $('timer').textContent = M.formatTime(game.elapsed);
    $('game-label').textContent = label(game);
    $('progress').textContent = `${game.moves}/${game.rows * game.cols / 2}쌍 찾음`;
    $('help-counts').textContent = `힌트 ${game.hintsUsed} · 되돌리기 ${game.undoUsed} · 재배치 ${game.shufflesUsed}`;
    $('undo-btn').disabled = paused || !game.history.length;
    $('hint-btn').disabled = paused || Boolean(animation) || blocked;
    $('shuffle-btn').disabled = paused || Boolean(animation) || !blocked;
    drawPath();
  }
  function updateBlocked(text) {
    blocked = !G.isDone(game) && !G.findPair(game);
    message(blocked ? '연결할 짝이 없어요. 되돌리거나 남은 패를 다시 배치하세요.'
      : text || '같은 그림 두 개를 눌러 연결하세요. 시간 제한은 없어요.');
  }
  function settle() {
    clearTimeout(animation); animation = 0; visual = null;
    $('connection').replaceChildren();
  }
  function begin() {
    if (!game.started) { game.started = true; startTimer(); }
  }
  function choose(index) {
    if (!game || paused || finished || animation || !game.board[index]) return;
    begin(); settle(); focusIndex = index;
    if (selected === index) {
      selected = -1; message('선택을 취소했어요.'); render(); save(); return;
    }
    if (selected < 0) {
      selected = index;
      message(`${G.SYMBOLS[game.board[index] - 1][1]} 선택 · 같은 그림을 하나 더 누르세요.`);
      render(); save(); return;
    }
    const a = selected, b = index, value = game.board[a];
    const path = G.remove(game, a, b);
    if (!path) {
      game.mistakes++; selected = b;
      message(value !== game.board[b] ? '다른 그림이에요. 지금 선택한 그림의 짝을 찾아보세요.'
        : '사이에 패가 있거나 너무 많이 꺾여요. 다른 짝을 찾아보세요.');
      MaeilFx.play('miss'); render(); save(); return;
    }
    selected = -1;
    MaeilFx.play('match'); MaeilFx.buzz(15);
    if (G.isDone(game)) { finish(); return; }
    focusIndex = game.board.findIndex(Boolean);
    visual = { a, b, path, value, removing: true };
    animation = setTimeout(() => {
      animation = 0; visual = null;
      if (finished || $('game-screen').hidden) return;
      updateBlocked('한 쌍을 찾았어요! 다음 그림도 연결해 보세요.'); render();
      if (document.activeElement === cells[a] || document.activeElement === cells[b]) cells[focusIndex].focus();
    }, 380);
    updateBlocked('연결했어요!'); render(); save();
  }
  function hint() {
    if (!game || paused || finished || animation) return;
    settle(); const pair = G.findPair(game);
    if (!pair) { updateBlocked(); render(); return; }
    begin(); game.hintsUsed++; selected = pair.a; focusIndex = pair.a; visual = pair;
    message(`${G.SYMBOLS[game.board[pair.a] - 1][1]} 두 개를 연결할 수 있어요. 테두리가 표시된 짝을 누르세요.`);
    render(); save();
  }
  function undo() {
    if (!game || paused || finished || !game.history.length) return;
    settle(); G.undo(game); selected = -1; focusIndex = game.board.findIndex(Boolean);
    updateBlocked('한 단계 되돌렸어요.'); render(); save();
  }
  function reshuffle() {
    if (!game || paused || finished || animation || !blocked) return;
    settle();
    if (!G.reshuffle(game)) return;
    begin(); selected = -1; focusIndex = game.board.findIndex(Boolean);
    updateBlocked('남은 패를 풀 수 있는 배치로 바꿨어요. 빈자리는 그대로예요.'); render(); save();
  }

  // 실제 칸 중심을 사용하므로 화면 폭·큰 글씨·세로 스크롤에 맞춰 경로가 정렬된다.
  function drawPath() {
    const svg = $('connection'); svg.replaceChildren();
    if (!visual?.path || typeof cells[0]?.getBoundingClientRect !== 'function') return;
    const bounds = $('board-area').getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const points = visual.path.map(([r, c]) => {
      const x = c === 0 ? 7 : c === game.cols + 1 ? bounds.width - 7
        : (() => { const b = cells[c - 1].getBoundingClientRect(); return b.left - bounds.left + b.width / 2; })();
      const y = r === 0 ? 7 : r === game.rows + 1 ? bounds.height - 7
        : (() => { const b = cells[(r - 1) * game.cols].getBoundingClientRect(); return b.top - bounds.top + b.height / 2; })();
      return `${x},${y}`;
    }).join(' ');
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points); svg.append(line);
  }

  function tick() {
    if (!timer || !game) return;
    const now = performance.now();
    game.elapsed += Math.max(0, now - lastTick) / 1000; lastTick = now;
  }
  function stopTimer() { tick(); clearInterval(timer); timer = 0; }
  function startTimer() {
    stopTimer(); lastTick = performance.now(); ticks = 0;
    timer = setInterval(() => {
      tick(); $('timer').textContent = M.formatTime(game.elapsed);
      if (++ticks % 20 === 0) save();
    }, 250);
  }
  function pause() {
    if (!game || paused || finished || $('game-screen').hidden) return;
    stopTimer(); settle(); paused = true;
    $('pause-overlay').hidden = false; render(); save(); $('resume-btn').focus();
  }
  function resume() {
    if (!game || !paused || finished) return;
    paused = false; $('pause-overlay').hidden = true;
    updateBlocked(); render(); if (game.started) startTimer(); $('pause-btn').focus();
  }
  function finish() {
    if (finished) return;
    stopTimer(); settle(); finished = true; clearSave();
    const time = seconds(game), key = game.daily ? 'daily' : game.difficulty;
    const data = stats(), previous = data[key];
    const best = Number.isFinite(previous?.best) ? previous.best : Infinity;
    const isBest = time < best;
    data[key] = { played: (Number.isSafeInteger(previous?.played) ? previous.played : 0) + 1, best: Math.min(time, best) };
    M.write(KEYS.stats, data);
    if (game.daily) {
      const old = M.read(KEYS.daily);
      if (!old || typeof old.date !== 'string' || old.date < game.daily || (old.date === game.daily && (!Number.isFinite(old.seconds) || time < old.seconds))) {
        M.write(KEYS.daily, { date: game.daily, seconds: time, hints: game.hintsUsed, undos: game.undoUsed, shuffles: game.shufflesUsed });
      }
      M.recordDaily(ID, game.daily);
    }
    summary();
    $('result-sub').textContent = label(game);
    $('result-time').textContent = M.formatTime(time);
    $('result-detail').textContent = `${game.moves}쌍 완료 · 힌트 ${game.hintsUsed}회 · 되돌리기 ${game.undoUsed}회 · 재배치 ${game.shufflesUsed}회`;
    $('result-best').textContent = isBest ? '새 최고 기록이에요!' : `내 최고 ${M.formatTime(best)}`;
    $('result-best').classList.toggle('new', isBest);
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '새 게임';
    screen('result-screen'); MaeilFx.celebrate({ isBest, won: true }); $('share-btn').focus();
  }
  function share() {
    M.share({ title: '사천성 — 매일게임',
      text: `[매일게임 사천성] ${label(game)} · ${M.formatTimeKorean(game.elapsed)}\n힌트 ${game.hintsUsed}회 · 되돌리기 ${game.undoUsed}회 · 재배치 ${game.shufflesUsed}회\n같이 즐겨요!`,
      url: M.pageUrl('sichuan/'),
    });
  }
  function keydown(event) {
    if ($('game-screen').hidden || finished) return;
    if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) (paused ? resume() : pause()); return; }
    const target = event.target?.closest?.('button'), index = cells.indexOf(target);
    if (index < 0 || paused || animation) return;
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -game.cols, ArrowDown: game.cols };
    if (event.key in steps) {
      event.preventDefault(); let next = index;
      for (let i = 0; i < game.board.length; i++) {
        next = (next + steps[event.key] + game.board.length) % game.board.length;
        if (game.board[next]) break;
      }
      focusIndex = next; render(); cells[next].focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (!event.repeat) choose(index);
    }
  }

  M.bindSettingButtons();
  picker = MaeilStart.setup({ id: ID,
    difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: `${c.rows}×${c.cols} · ${c.rows * c.cols / 2}쌍 · 시간 제한 없음` })),
    bestText: (key) => Number.isFinite(stats()[key]?.best) ? `내 최고 ${M.formatTime(stats()[key].best)}` : '',
    onStart: (key) => start(G.create(key)), onDaily: startDaily,
  });
  $('continue-btn').addEventListener('click', () => { const saved = loadGame(); if (saved) start(saved); else renderStart(); });
  $('home-btn').addEventListener('click', () => { stopTimer(); settle(); save(); renderStart(); });
  $('pause-btn').addEventListener('click', pause); $('resume-btn').addEventListener('click', resume);
  $('hint-btn').addEventListener('click', hint); $('undo-btn').addEventListener('click', undo);
  $('shuffle-btn').addEventListener('click', reshuffle); $('share-btn').addEventListener('click', share);
  $('again-btn').addEventListener('click', () => game.daily ? startDaily() : start(G.create(game.difficulty)));
  $('result-home-btn').addEventListener('click', renderStart);
  document.addEventListener('keydown', keydown);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { if (!finished && !$('game-screen').hidden) pause(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted && game && !finished && !$('game-screen').hidden) pause(); });
  window.addEventListener('resize', drawPath);
  if (typeof ResizeObserver === 'function') new ResizeObserver(drawPath).observe($('board-area'));
  renderStart(); summary(); MaeilStart.handleDailyLink(startDaily); M.registerOffline('../');
})();
