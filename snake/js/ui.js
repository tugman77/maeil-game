// 스네이크 화면·조작·저장. 시간에 따른 이동만 여기서 처리하고 규칙은 logic.js에 둔다.
(() => {
  const M = MaeilGame;
  const G = Snake;
  const ID = 'snake';
  const KEYS = { game: 'maeil-game.snake.game.v1', stats: 'maeil-game.snake.stats.v1', daily: 'maeil-game.snake.daily.v1' };
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ko-KR');
  let game = null;
  let picker;
  let cells = [];
  let running = false;
  let waiting = false;
  let paused = false;
  let finished = false;
  let frame = 0;
  let lastTime = 0;
  let accumulator = 0;
  let finishTimer = 0;

  const loadStats = () => {
    const saved = M.read(KEYS.stats);
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  };
  const loadGame = () => { const saved = M.read(KEYS.game); return G.isValid(saved) && !saved.over ? saved : null; };
  const saveGame = () => { if (game && !game.over) M.write(KEYS.game, game); };
  const clearGame = () => { try { localStorage.removeItem(KEYS.game); } catch {} };
  const dailyResult = (date) => { const saved = M.read(KEYS.daily); return saved && saved.date === date ? saved : null; };
  const label = (state) => state.daily ? `${M.dateLabel(state.daily)} 오늘의 도전` : `${G.DIFFICULTIES[state.difficulty].label} 난이도`;

  function updateSummary() {
    const best = Math.max(0, ...Object.values(loadStats()).map((s) => Number.isFinite(s?.best) ? s.best : 0));
    if (best) M.setSummary(ID, `최고 ${fmt(best)}점`);
  }

  function showScreen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((screen) => { $(screen).hidden = screen !== id; });
    window.scrollTo(0, 0);
  }

  function renderStart() {
    stopLoop();
    clearTimeout(finishTimer);
    const today = M.todayKey();
    const daily = dailyResult(today);
    const done = M.dailyDone(ID, today);
    picker.setDaily(`${M.dateLabel(today)} · ${done ? `완료 ✓ 최고 ${fmt(daily?.score || 0)}점` : `같은 시작 판 · 먹이 ${G.DAILY_TARGET}개 목표`}`, done);
    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) $('continue-info').textContent = `${label(saved)} · ${fmt(saved.score)}점 · 길이 ${saved.body.length}`;
    picker.refresh();
    showScreen('start-screen');
  }

  function buildBoard() {
    cells = Array.from({ length: G.COLS * G.ROWS }, () => {
      const cell = document.createElement('span');
      cell.className = 'snake-cell';
      cell.setAttribute('aria-hidden', 'true');
      return cell;
    });
    $('board').replaceChildren(...cells);
  }

  function render() {
    const body = new Set(game.body);
    cells.forEach((cell, i) => {
      let className = 'snake-cell';
      if (body.has(i)) className += ' body';
      if (i === game.body[game.body.length - 1]) className += ' tail';
      if (i === game.body[0]) className += ` head ${game.direction}${game.over && !game.won ? ' hit' : ''}`;
      if (i === game.food) className += ' food';
      if (cell.className !== className) cell.className = className;
    });
    $('score').textContent = fmt(game.score);
    $('eaten').textContent = game.eaten;
    const goal = game.eaten >= G.DAILY_TARGET;
    const status = game.daily
      ? (goal ? `오늘의 목표 완료! · 먹이 ${game.eaten}개` : `오늘의 목표 ${game.eaten}/${G.DAILY_TARGET}개`)
      : `길이 ${game.body.length} · 먹이 하나에 ${G.FOOD_SCORE}점`;
    // 매 틱마다 같은 문구를 다시 읽지 않도록 바뀐 경우에만 갱신한다.
    if ($('game-status').textContent !== status) $('game-status').textContent = status;
    const head = game.body[0];
    const food = game.food;
    $('board').setAttribute('aria-label', `스네이크 16×16 판. 머리 ${Math.floor(head / G.COLS) + 1}행 ${head % G.COLS + 1}열, 길이 ${game.body.length}. ${food === null ? '판을 모두 채웠어요.' : `먹이 ${Math.floor(food / G.COLS) + 1}행 ${food % G.COLS + 1}열.`}`);
  }

  function start(state) {
    stopLoop();
    clearTimeout(finishTimer);
    game = state;
    accumulator = 0;
    waiting = true;
    paused = false;
    finished = false;
    M.markPlayed(ID);
    saveGame();
    buildBoard();
    $('game-label').textContent = label(game);
    $('announcement').textContent = '';
    $('pause-title').textContent = '준비됐나요?';
    $('pause-note').textContent = '방향 버튼이나 방향키로도 출발할 수 있어요';
    $('resume-btn').textContent = '출발하기';
    $('pause-btn').textContent = '출발';
    $('pause-overlay').hidden = false;
    showScreen('game-screen');
    render();
    $('resume-btn').focus({ preventScroll: true });
  }

  function startDaily() {
    const today = M.todayKey();
    const saved = loadGame();
    start(saved && saved.daily === today ? saved : G.create(G.DAILY_DIFFICULTY, { daily: today }));
  }

  function stopLoop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  function startLoop() {
    stopLoop();
    running = true;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!running) return;
    // 화면이 지연되어도 여러 칸을 갑자기 뛰어가지 않는다.
    const dt = Math.min(Math.max(0, now - lastTime), 100);
    lastTime = now;
    game.elapsed += dt / 1000;
    accumulator += dt;
    if (accumulator >= G.interval(game)) {
      accumulator -= G.interval(game);
      const result = G.step(game);
      if (result === 'ate' || result === 'won') {
        MaeilFx.play('place');
        MaeilFx.pulse($('board'), 'ate', 180);
        recordDailyProgress();
      }
      render();
      if (game.over) {
        stopLoop();
        clearGame();
        $('announcement').textContent = game.won ? '판을 모두 채웠어요!' : game.reason === 'wall' ? '벽에 닿았어요' : '자기 몸에 닿았어요';
        finishTimer = setTimeout(finish, 350);
        return;
      }
      saveGame();
    }
    if (running) frame = requestAnimationFrame(tick);
  }

  function recordDailyProgress() {
    if (!game.daily) return;
    const old = M.read(KEYS.daily);
    // 지난 날짜의 이어하기가 오늘의 기록을 덮어쓰지 않도록 한다.
    if (!old || old.date < game.daily || (old.date === game.daily && game.score > old.score)) {
      M.write(KEYS.daily, { date: game.daily, score: game.score, eaten: game.eaten });
    }
    if (game.eaten >= G.DAILY_TARGET && !M.dailyDone(ID, game.daily)) {
      M.recordDaily(ID, game.daily);
      M.showToast('오늘의 도전 완료! 계속 기록을 늘려 보세요');
      MaeilFx.play('success');
      MaeilFx.buzz(25);
    }
  }

  function act(direction) {
    if (!game || game.over || paused || $('game-screen').hidden) return;
    G.turn(game, direction);
    if (waiting) resume();
    saveGame();
  }

  function pause() {
    if (!game || game.over || paused || $('game-screen').hidden) return;
    paused = true;
    waiting = false;
    stopLoop();
    saveGame();
    $('pause-title').textContent = '일시정지';
    $('pause-note').textContent = '하던 판과 기록은 자동으로 저장돼요';
    $('resume-btn').textContent = '계속하기';
    $('pause-btn').textContent = '계속';
    $('pause-overlay').hidden = false;
  }

  function resume() {
    if (!game || game.over || (!paused && !waiting)) return;
    paused = false;
    waiting = false;
    accumulator = 0;
    $('pause-overlay').hidden = true;
    $('pause-btn').textContent = '정지';
    startLoop();
  }

  function finish() {
    if (finished || !game || !game.over) return;
    finished = true;
    stopLoop();
    clearGame();
    const key = game.daily ? 'daily' : game.difficulty;
    const stats = loadStats();
    const entry = stats[key] || {};
    const previous = Number.isFinite(entry.best) ? entry.best : 0;
    const isBest = game.score > previous;
    stats[key] = { played: (Number.isInteger(entry.played) ? entry.played : 0) + 1, best: Math.max(previous, game.score), bestLength: Math.max(entry.bestLength || 0, game.body.length) };
    M.write(KEYS.stats, stats);
    recordDailyProgress();
    updateSummary();
    $('result-title').textContent = game.won ? '판을 모두 채웠어요!' : '다음엔 더 길게!';
    $('result-sub').textContent = label(game);
    $('result-score').textContent = fmt(game.score);
    $('result-detail').textContent = `먹이 ${game.eaten}개 · 길이 ${game.body.length} · ${M.formatTime(game.elapsed)}`;
    $('result-best').textContent = isBest ? (previous ? `새 최고 점수! 이전 ${fmt(previous)}점` : '첫 기록이 저장됐어요!') : `내 최고 ${fmt(stats[key].best)}점`;
    $('result-best').classList.toggle('new', isBest);
    $('result-daily').textContent = game.daily
      ? (game.eaten >= G.DAILY_TARGET ? '오늘의 목표 완료 ✓ 출석을 남겼어요' : `먹이 ${G.DAILY_TARGET}개를 먹으면 오늘의 도전 완료!`)
      : (game.reason === 'wall' ? '벽을 만나기 전에 방향을 바꿔 보세요.' : game.won ? '빈칸 없이 완벽한 한 판이에요.' : '꼬리가 지나갈 자리를 남겨 두세요.');
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '한 판 더';
    showScreen('result-screen');
    MaeilFx.countUp($('result-score'), game.score, fmt);
    MaeilFx.celebrate({ isBest, won: game.won });
    $('share-btn').focus({ preventScroll: true });
  }

  function bindControls() {
    document.querySelectorAll('[data-direction]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        act(button.dataset.direction);
      });
      // 실제 포인터 입력은 위에서, 키보드·보조 기술의 click은 여기서 처리한다.
      button.addEventListener('click', (event) => { if (event.detail === 0) act(button.dataset.direction); });
    });
    const area = $('board-area');
    let pointer = null;
    const swipe = (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    area.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      area.setPointerCapture(event.pointerId);
    });
    area.addEventListener('pointermove', swipe);
    area.addEventListener('pointerup', (event) => { swipe(event); if (pointer?.id === event.pointerId) pointer = null; });
    ['pointercancel', 'lostpointercapture'].forEach((type) => area.addEventListener(type, () => { pointer = null; }));
    document.addEventListener('keydown', (event) => {
      if ($('game-screen').hidden || !game || game.over || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'escape' || key === 'p') {
        event.preventDefault();
        if (!event.repeat) (paused || waiting ? resume() : pause());
        return;
      }
      const direction = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }[key];
      if (direction) { event.preventDefault(); if (!event.repeat) act(direction); }
    });
  }

  function init() {
    M.bindSettingButtons();
    picker = MaeilStart.setup({
      id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: c.note })),
      bestText: (key) => loadStats()[key]?.best ? `내 최고 ${fmt(loadStats()[key].best)}점` : '',
      onStart: (key) => start(G.create(key)), onDaily: startDaily,
    });
    bindControls();
    $('continue-btn').addEventListener('click', () => { const saved = loadGame(); if (saved) start(saved); else renderStart(); });
    $('home-btn').addEventListener('click', () => { if (game?.over) finish(); else { saveGame(); renderStart(); } });
    $('pause-btn').addEventListener('click', () => (paused || waiting ? resume() : pause()));
    $('resume-btn').addEventListener('click', resume);
    $('again-btn').addEventListener('click', () => game.daily ? startDaily() : start(G.create(game.difficulty)));
    $('result-home-btn').addEventListener('click', renderStart);
    $('share-btn').addEventListener('click', () => M.share({
      title: '스네이크 — 매일게임',
      text: `[매일게임 스네이크] ${label(game)} · ${fmt(game.score)}점 · 먹이 ${game.eaten}개 · 길이 ${game.body.length}!`,
      url: M.pageUrl('snake/'),
    }));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (game?.over && !$('game-screen').hidden) finish(); else pause(); }
    });
    window.addEventListener('pagehide', () => {
      if (game?.over && !$('game-screen').hidden) finish();
      stopLoop();
      saveGame();
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && game && !game.over && !$('game-screen').hidden) pause();
    });
    renderStart();
    updateSummary();
    MaeilStart.handleDailyLink(startDaily);
    M.registerOffline('../');
  }

  init();
})();
