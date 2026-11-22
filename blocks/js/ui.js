// 블록 쌓기 화면·시간 흐름·조작. 규칙은 logic.js.
// 시간: 일정 간격으로 한 칸씩 떨어지고, 바닥에 닿으면 0.45초 기다렸다 고정(그동안 옆으로 밀거나 돌릴 수 있음).
(() => {
  const M = MaeilGame;
  const G = Blocks;
  const ID = 'blocks';
  const KEYS = {
    game: 'maeil-game.blocks.game.v1',
    stats: 'maeil-game.blocks.stats.v1', // { easy: { played, best, bestLines }, ..., daily: {...} }
    daily: 'maeil-game.blocks.daily.v1', // { date, score, lines } 그날 가장 높은 점수
  };
  const LOCK_DELAY = 450;
  const MAX_LOCK_RESETS = 15;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ko-KR');

  let game = null;
  let picker = null; // 시작 화면(난이도 선택·오늘의 도전) — common/start.js
  let cells = [];
  let nextCells = [];
  let running = false;
  let paused = false;
  let frame = 0;
  let lastTime = 0;
  let dropAcc = 0;
  let lockAcc = 0;
  let lockResets = 0;
  let dirty = true;
  let clearing = null; // { rows, until } 줄이 빛나는 중
  let levelSeen = 1;
  const CLEAR_MS = 250;

  // ---------- 저장 ----------
  const loadStats = () => M.read(KEYS.stats) || {};
  function loadGame() {
    const saved = M.read(KEYS.game);
    return G.isValid(saved) && !saved.over ? saved : null;
  }
  const saveGame = () => { if (game && !game.over) M.write(KEYS.game, game); };
  const clearGame = () => { try { localStorage.removeItem(KEYS.game); } catch {} };
  function loadDailyResult(date) {
    const saved = M.read(KEYS.daily);
    return saved && saved.date === date ? saved : null;
  }
  const statKey = (state) => (state.daily ? 'daily' : state.difficulty);
  const label = (state) => (state.daily ? `📅 ${M.dateLabel(state.daily)} 오늘의 도전` : `${G.DIFFICULTIES[state.difficulty].label} 난이도`);

  function updateSummary() {
    const stats = loadStats();
    const best = Math.max(0, ...Object.values(stats).map((s) => s.best || 0));
    if (best > 0) M.setSummary(ID, `최고 ${fmt(best)}점`);
  }

  // ---------- 화면 ----------
  function showScreen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function renderStart() {
    stopLoop();
    const today = M.todayKey();
    const daily = loadDailyResult(today);
    picker.setDaily(daily
      ? `${M.dateLabel(today)} · 완료 ✓ ${fmt(daily.score)}점`
      : `${M.dateLabel(today)} · 모두 같은 블록 순서`, Boolean(daily));

    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) $('continue-info').textContent = `${label(saved)} · ${fmt(saved.score)}점 · ${saved.lines}줄`;
    picker.refresh();
    showScreen('start-screen');
  }

  function buildBoard() {
    const board = $('board');
    cells = Array.from({ length: G.COLS * G.ROWS }, () => {
      const cell = document.createElement('div');
      cell.className = 'bcell';
      return cell;
    });
    board.replaceChildren(...cells);
    nextCells = Array.from({ length: 16 }, () => document.createElement('span'));
    $('next').replaceChildren(...nextCells);
  }

  function render() {
    dirty = false;
    const view = game.board.slice();
    const ghost = new Set();
    if (!game.over) {
      const color = G.COLOR_OF[game.piece.type];
      const gy = G.ghostY(game);
      G.cellsOf(game.piece.type, game.piece.rot).forEach(([cx, cy]) => {
        const x = game.piece.x + cx;
        const gyCell = gy + cy;
        if (gyCell >= 0) ghost.add(gyCell * G.COLS + x);
        const y = game.piece.y + cy;
        if (y >= 0) view[y * G.COLS + x] = color;
      });
    }
    const glowing = new Set(clearing ? clearing.rows : []);
    view.forEach((value, i) => {
      let cls = value ? `bcell f c${value}` : ghost.has(i) ? 'bcell ghost' : 'bcell';
      if (glowing.has(Math.floor(i / G.COLS))) cls += ' clearing';
      if (cells[i].className !== cls) cells[i].className = cls;
    });
    // 다음 블록 (4×4 안에 가운데 정렬)
    const shape = G.cellsOf(game.next, 0);
    const xs = shape.map(([x]) => x);
    const ys = shape.map(([, y]) => y);
    const offX = Math.floor((4 - (Math.max(...xs) - Math.min(...xs) + 1)) / 2) - Math.min(...xs);
    const offY = Math.floor((4 - (Math.max(...ys) - Math.min(...ys) + 1)) / 2) - Math.min(...ys);
    const filled = new Set(shape.map(([x, y]) => (y + offY) * 4 + (x + offX)));
    nextCells.forEach((span, i) => { span.className = filled.has(i) ? `c${G.COLOR_OF[game.next]}` : ''; });

    $('score').textContent = fmt(game.score);
    $('lines').textContent = game.lines;
    $('level').textContent = game.level;
  }

  // ---------- 게임 진행 ----------
  function start(state) {
    game = state;
    paused = false;
    dropAcc = 0;
    lockAcc = 0;
    lockResets = 0;
    clearing = null;
    levelSeen = state.level;
    M.markPlayed(ID);
    saveGame();
    buildBoard();
    $('game-label-short').textContent = game.daily ? '📅 오늘의\n도전' : G.DIFFICULTIES[game.difficulty].label;
    $('pause-overlay').hidden = true;
    showScreen('game-screen');
    render();
    startLoop();
  }

  function startDaily() {
    const today = M.todayKey();
    const saved = loadGame();
    if (saved && saved.daily === today) {
      start(saved);
      return;
    }
    start(G.create(G.DAILY_DIFFICULTY, { daily: today, seedText: `maeil-blocks:${today}` }));
  }

  function startLoop() {
    stopLoop();
    running = true;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stopLoop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(now - lastTime, 100); // 화면이 잠깐 멈췄다 돌아와도 한꺼번에 떨어지지 않게
    lastTime = now;
    game.elapsed += dt / 1000;
    if (clearing) {
      // 줄이 빛나는 동안은 멈춰 있다가, 끝나면 고정하고 줄을 지운다
      if (now >= clearing.until) {
        clearing = null;
        afterLock(G.lock(game));
      }
    } else if (G.canFall(game)) {
      lockAcc = 0;
      dropAcc += dt;
      if (dropAcc >= G.interval(game)) {
        dropAcc = 0;
        G.stepDown(game);
        dirty = true;
      }
    } else {
      lockAcc += dt;
      if (lockAcc >= LOCK_DELAY) beginLock();
    }
    if (dirty) render();
    if (running) frame = requestAnimationFrame(tick);
  }

  // 고정 시작: 꽉 찰 줄이 있으면 그 줄을 0.25초 빛낸 뒤(clearing) 지우고, 없으면 바로 고정
  function beginLock() {
    const rows = G.fullRowsIfLocked(game);
    if (rows.length) {
      clearing = { rows, until: performance.now() + CLEAR_MS };
      MaeilFx.play('clear', { lines: rows.length });
      MaeilFx.buzz(rows.length >= 4 ? [30, 40, 30] : 20);
      dirty = true;
      render();
    } else {
      MaeilFx.play('lock');
      afterLock(G.lock(game));
    }
  }

  function afterLock(result) {
    const levelBefore = levelSeen;
    dropAcc = 0;
    lockAcc = 0;
    lockResets = 0;
    dirty = true;
    levelSeen = game.level;
    if (result.cleared.length >= 4) M.showToast('🎉 네 줄 한 번에!');
    else if (game.level > levelBefore) {
      M.showToast(`🎉 ${game.level}단계! 조금 더 빨라져요`);
      MaeilFx.play('levelup');
    }
    if (game.over) {
      stopLoop();
      render();
      setTimeout(finish, 700);
    } else {
      saveGame();
    }
  }

  // 바닥에 닿은 채 옮기거나 돌리면 고정까지 기다리는 시간을 다시 센다(너무 오래 버티지는 못하게 15번까지).
  function touched() {
    dirty = true;
    if (!G.canFall(game) && lockResets < MAX_LOCK_RESETS) {
      lockAcc = 0;
      lockResets++;
    }
  }

  function act(kind) {
    if (!game || game.over || paused || !running || clearing) return;
    if (kind === 'left' && G.move(game, -1)) touched();
    else if (kind === 'right' && G.move(game, 1)) touched();
    else if (kind === 'rotate' && G.rotate(game, 1)) { touched(); MaeilFx.play('rotate'); }
    else if (kind === 'rotateBack' && G.rotate(game, -1)) { touched(); MaeilFx.play('rotate'); }
    else if (kind === 'down') {
      if (G.stepDown(game)) {
        game.score += 1;
        dropAcc = 0;
        dirty = true;
      }
    } else if (kind === 'drop') {
      // 바로 떨어뜨리기: 바닥까지 내리고 '쿵'(판이 살짝 흔들림) → 고정
      if (G.dropToGround(game) > 0) MaeilFx.pulse($('board'), 'thud', 160);
      MaeilFx.play('thud');
      dirty = true;
      render();
      beginLock();
    }
    if (dirty) render();
  }

  // ---------- 일시정지 ----------
  function pause() {
    if (paused || !game || game.over || $('game-screen').hidden) return;
    paused = true;
    stopLoop();
    $('pause-overlay').hidden = false;
    saveGame();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    $('pause-overlay').hidden = true;
    startLoop();
  }

  // ---------- 끝 ----------
  function finish() {
    clearGame();
    const key = statKey(game);
    const stats = loadStats();
    const entry = stats[key] || { played: 0, best: 0, bestLines: 0 };
    const previous = entry.best;
    const isBest = game.score > previous;
    stats[key] = {
      played: entry.played + 1,
      best: Math.max(previous, game.score),
      bestLines: Math.max(entry.bestLines, game.lines),
    };
    M.write(KEYS.stats, stats);
    if (game.daily) {
      const before = loadDailyResult(game.daily);
      if (!before || game.score > before.score) M.write(KEYS.daily, { date: game.daily, score: game.score, lines: game.lines });
      M.recordDaily(ID, game.daily);
    }
    updateSummary();

    $('result-sub').textContent = label(game);
    $('result-score').textContent = fmt(game.score);
    $('result-detail').textContent = `${game.lines}줄 없앰 · ${game.level}단계 · ${M.formatTime(game.elapsed)}`;
    const best = $('result-best');
    best.classList.toggle('new', isBest && game.score > 0);
    best.textContent = isBest && game.score > 0
      ? (previous ? `🏆 새 최고 점수! (이전 ${fmt(previous)})` : '🏆 첫 기록이 저장됐어요!')
      : `최고 점수 ${fmt(stats[key].best)}`;
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '새 게임';
    showScreen('result-screen');
    MaeilFx.countUp($('result-score'), game.score, fmt);
    MaeilFx.celebrate({ isBest: isBest && game.score > 0, won: false });
    $('share-btn').focus();
  }

  function share() {
    const what = game.daily ? `${M.dateLabel(game.daily)} 오늘의 도전에서` : `${G.DIFFICULTIES[game.difficulty].label} 난이도에서`;
    M.share({
      title: '블록 쌓기 — 매일게임',
      text: `[매일게임 블록 쌓기] ${what} ${fmt(game.score)}점, ${game.lines}줄! 🧱\n같이 해봐요 👉`,
      url: M.pageUrl('blocks/'),
    });
  }

  // ---------- 조작: 버튼(누르고 있으면 반복)·판 위 밀기·키보드 ----------
  function bindPad() {
    document.querySelectorAll('.pad-btn').forEach((button) => {
      const kind = button.dataset.act;
      const repeat = kind === 'left' || kind === 'right' || kind === 'down';
      let delay = 0;
      let timer = 0;
      const stop = () => {
        clearTimeout(delay);
        clearInterval(timer);
        button.classList.remove('held');
      };
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.classList.add('held');
        act(kind);
        if (repeat) {
          delay = setTimeout(() => { timer = setInterval(() => act(kind), kind === 'down' ? 45 : 70); }, 180);
        }
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => button.addEventListener(type, stop));
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    });
  }

  function bindGestures() {
    const area = $('board-area');
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let startTime = 0;
    let moved = false;
    let tracking = false;
    const cellSize = () => cells[0]?.getBoundingClientRect().width || 24;
    area.addEventListener('pointerdown', (event) => {
      tracking = true;
      moved = false;
      startX = baseX = event.clientX;
      startY = baseY = event.clientY;
      startTime = performance.now();
    });
    area.addEventListener('pointermove', (event) => {
      if (!tracking) return;
      const size = cellSize();
      while (event.clientX - baseX >= size) { act('right'); baseX += size; moved = true; }
      while (baseX - event.clientX >= size) { act('left'); baseX -= size; moved = true; }
      while (event.clientY - baseY >= size * 1.2) { act('down'); baseY += size * 1.2; moved = true; }
    });
    area.addEventListener('pointerup', (event) => {
      if (!tracking) return;
      tracking = false;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const time = performance.now() - startTime;
      if (dy > cellSize() * 2.5 && dy > Math.abs(dx) * 1.5 && time < 280) act('drop'); // 아래로 휙
      else if (!moved && Math.abs(dx) < 10 && Math.abs(dy) < 10) act('rotate'); // 톡 누르기
    });
    area.addEventListener('pointercancel', () => { tracking = false; });
    area.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  }

  function handleKey(event) {
    if ($('game-screen').hidden || !game || game.over || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
      event.preventDefault();
      (paused ? resume() : pause());
      return;
    }
    const keys = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate', ' ': 'drop', x: 'rotate', z: 'rotateBack',
    };
    const kind = keys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (kind) {
      event.preventDefault();
      act(kind);
    }
  }

  function init() {
    M.bindSettingButtons();
    bindPad();
    bindGestures();
    picker = MaeilStart.setup({
      id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: c.note })),
      bestText: (key) => { const best = loadStats()[key]?.best; return best ? `내 최고 ${fmt(best)}점` : ''; },
      onStart: (key) => start(G.create(key)),
      onDaily: startDaily,
    });
    $('continue-btn').addEventListener('click', () => { const saved = loadGame(); if (saved) start(saved); else renderStart(); });
    $('home-btn').addEventListener('click', () => { stopLoop(); saveGame(); renderStart(); });
    $('pause-btn').addEventListener('click', () => (paused ? resume() : pause()));
    $('resume-btn').addEventListener('click', resume);
    $('share-btn').addEventListener('click', share);
    $('again-btn').addEventListener('click', () => (game.daily ? startDaily() : start(G.create(game.difficulty))));
    $('result-home-btn').addEventListener('click', renderStart);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', () => { stopLoop(); saveGame(); });
    window.addEventListener('pageshow', (event) => { if (event.persisted && game && !game.over && !$('game-screen').hidden) { paused = false; pause(); } });
    renderStart();
    updateSummary();
    MaeilStart.handleDailyLink(startDaily);
    M.registerOffline('../');
  }

  init();
})();
