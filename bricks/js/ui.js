// 벽돌깨기 화면·조작·저장. 규칙(공·벽돌·받침대)은 logic.js.
// 조작: 판 위에서 손가락(마우스)을 좌우로 움직이면 받침대가 따라오고, 누르면 공이 출발. PC는 ←→·스페이스.
(() => {
  const M = MaeilGame;
  const G = Bricks;
  const ID = 'bricks';
  const KEYS = { game: 'maeil-game.bricks.game.v1', stats: 'maeil-game.bricks.stats.v1' };
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ko-KR');
  const ROW_COLORS = ['#e0674f', '#ef8a3c', '#f2b01e', '#5bbf8c', '#2f8f6b', '#3b6fc4', '#7d5cc6', '#c4508c'];
  let game = null;
  let picker;
  let canvas;
  let ctx;
  let scale = 1;
  let running = false;
  let paused = false;
  let finished = false;
  let frame = 0;
  let lastTime = 0;
  let keyDir = 0;
  let finishTimer = 0;
  let sparks = []; // 깨진 벽돌 조각 {x,y,vx,vy,c,t}
  let flash = 0;   // 단계 통과 알림 남은 시간

  const loadStats = () => { const s = M.read(KEYS.stats); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; };
  const loadGame = () => { const s = M.read(KEYS.game); return G.isValid(s) && !s.over ? s : null; };
  const saveGame = () => { if (game && !game.over) M.write(KEYS.game, game); };
  const clearGame = () => { try { localStorage.removeItem(KEYS.game); } catch {} };
  const label = (s) => (s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : `${G.DIFFICULTIES[s.difficulty].label} 난이도`);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function updateSummary() {
    const best = Math.max(0, ...Object.values(loadStats()).map((s) => (Number.isFinite(s?.best) ? s.best : 0)));
    if (best) M.setSummary(ID, `최고 ${fmt(best)}점`);
  }

  function showScreen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function renderStart() {
    stopLoop();
    clearTimeout(finishTimer);
    const today = M.todayKey();
    const done = M.dailyDone(ID, today);
    const daily = loadStats().daily;
    picker.setDaily(`${M.dateLabel(today)} · ${done ? `완료 ✓${daily?.best ? ` 최고 ${fmt(daily.best)}점` : ''}` : '오늘의 판 · 벽돌을 모두 깨면 완료'}`, done);
    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    if (saved) $('continue-info').textContent = `${label(saved)} · ${saved.level}단계 · ${fmt(saved.score)}점`;
    picker.refresh();
    showScreen('start-screen');
  }

  // ---------- 그리기 ----------
  function resize() {
    if (!canvas) return;
    const box = $('board-area');
    const maxW = Math.min(420, window.innerWidth - 24);
    const maxH = Math.max(300, window.innerHeight - 190);
    const w = Math.floor(Math.min(maxW, (maxH * G.W) / G.H));
    const h = Math.floor((w * G.H) / G.W);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    box.style.width = `${w}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = (w * dpr) / G.W;
    draw();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    if (!ctx || !game) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = dark ? '#161c24' : '#f3f6fb';
    ctx.fillRect(0, 0, G.W, G.H);
    // 벽돌
    for (let i = 0; i < game.bricks.length; i++) {
      const hp = game.bricks[i];
      if (!hp) continue;
      const r = Math.floor(i / G.COLS);
      const x = G.brickX(i % G.COLS);
      const y = G.brickY(r);
      ctx.fillStyle = ROW_COLORS[r % ROW_COLORS.length];
      roundRect(x, y, G.BRICK_W, G.BRICK_H, 3);
      ctx.fill();
      if (hp === 2) {
        // 두 번 맞아야 깨지는 벽돌: 진한 테두리 + 가운데 줄
        ctx.strokeStyle = dark ? '#ffffff' : '#1d2420';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(x + 6, y + G.BRICK_H / 2 - 1, G.BRICK_W - 12, 2);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(x + 3, y + 2, G.BRICK_W - 6, 3);
      }
    }
    // 조각
    sparks.forEach((p) => {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.5);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
    // 받침대
    const pw = G.paddleWidth(game);
    ctx.fillStyle = dark ? '#7fb3ff' : '#1e6b48';
    roundRect(game.paddle - pw / 2, G.PADDLE_Y, pw, G.PADDLE_H, 6);
    ctx.fill();
    // 공
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, G.R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#ffd166' : '#e0674f';
    ctx.fill();
    // 안내 문구
    ctx.textAlign = 'center';
    ctx.fillStyle = dark ? '#e8edf3' : '#1d2420';
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash);
      ctx.font = 'bold 26px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(`${game.level}단계!`, G.W / 2, 300);
      ctx.globalAlpha = 1;
    } else if (game.ball.stuck && !game.over) {
      ctx.font = '600 15px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText('판을 누르면 공이 출발해요', G.W / 2, 330);
    }
  }

  function hud() {
    $('score').textContent = fmt(game.score);
    $('level').textContent = game.level;
    $('lives').textContent = game.lives;
  }

  // ---------- 진행 ----------
  function start(state, { resumePaused = false } = {}) {
    stopLoop();
    clearTimeout(finishTimer);
    game = state;
    finished = false;
    paused = false;
    sparks = [];
    flash = 0;
    M.markPlayed(ID);
    saveGame();
    $('game-label').textContent = label(game);
    $('pause-overlay').hidden = true;
    $('pause-btn').textContent = '정지';
    showScreen('game-screen');
    resize();
    hud();
    if (resumePaused && !game.ball.stuck) pause();
    else startLoop();
  }

  function startDaily() {
    const today = M.todayKey();
    const saved = loadGame();
    if (saved && saved.daily === today) start(saved, { resumePaused: true });
    else start(G.create(G.DAILY_DIFFICULTY, { daily: today }));
  }

  function stopLoop() { running = false; cancelAnimationFrame(frame); }
  function startLoop() {
    stopLoop();
    running = true;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (keyDir) G.setPaddle(game, game.paddle + keyDir * 380 * dt);
    const events = G.step(game, dt);
    for (const e of events) handle(e);
    sparks.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; });
    sparks = sparks.filter((p) => p.t < 0.5);
    if (flash > 0) flash -= dt;
    draw();
    if (events.length) hud();
    if (game.over) {
      stopLoop();
      clearGame();
      finishTimer = setTimeout(finish, game.won ? 500 : 700);
      return;
    }
    if (running) frame = requestAnimationFrame(tick);
  }

  function handle(e) {
    if (e.type === 'paddle') MaeilFx.play('bounce');
    else if (e.type === 'wall') MaeilFx.play('tap');
    else if (e.type === 'brick') MaeilFx.play('brick', { row: e.row });
    else if (e.type === 'break') {
      MaeilFx.play('brick', { row: e.row });
      const x = G.brickX(e.col) + G.BRICK_W / 2;
      const y = G.brickY(e.row) + G.BRICK_H / 2;
      const c = ROW_COLORS[e.row % ROW_COLORS.length];
      for (let k = 0; k < 6; k++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 120, c, t: 0 });
    } else if (e.type === 'lost') {
      MaeilFx.play(game.lives > 0 ? 'miss' : 'thud');
      MaeilFx.buzz(40);
      MaeilFx.pulse($('board-area'), 'shake', 400);
      saveGame();
    } else if (e.type === 'clear') {
      MaeilFx.play(game.over ? 'success' : 'levelup');
      if (!game.over) { flash = 1.4; saveGame(); }
    }
  }

  function pause() {
    if (!game || game.over || paused || $('game-screen').hidden) return;
    paused = true;
    stopLoop();
    saveGame();
    $('pause-overlay').hidden = false;
    $('pause-btn').textContent = '계속';
    $('resume-btn').focus({ preventScroll: true });
  }

  function resume() {
    if (!game || game.over || !paused) return;
    paused = false;
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
    const e = stats[key] || {};
    const previous = Number.isFinite(e.best) ? e.best : 0;
    const isBest = game.score > previous;
    stats[key] = { played: (e.played || 0) + 1, best: Math.max(previous, game.score), bestLevel: Math.max(e.bestLevel || 0, game.level) };
    M.write(KEYS.stats, stats);
    if (game.daily && game.won && !M.dailyDone(ID, game.daily)) M.recordDaily(ID, game.daily);
    updateSummary();
    $('result-title').textContent = game.won ? '모두 깼어요!' : '공을 모두 놓쳤어요';
    $('result-sub').textContent = label(game);
    $('result-score').textContent = fmt(game.score);
    $('result-detail').textContent = `${game.daily ? '' : `${game.level}단계 · `}깬 벽돌 ${game.broken}개 · ${M.formatTime(game.elapsed)}`;
    $('result-best').textContent = isBest ? (previous ? `새 최고 점수! 이전 ${fmt(previous)}점` : '첫 기록이 저장됐어요!') : `내 최고 ${fmt(stats[key].best)}점`;
    $('result-best').classList.toggle('new', isBest);
    $('result-daily').textContent = game.daily
      ? (game.won ? '오늘의 도전 완료 ✓ 출석을 남겼어요' : `남은 벽돌 ${G.remaining(game)}개 · 모두 깨면 오늘의 도전 완료!`)
      : '받침대 끝으로 받으면 공이 비스듬히 날아가요';
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '한 판 더';
    showScreen('result-screen');
    MaeilFx.countUp($('result-score'), game.score, fmt);
    MaeilFx.celebrate({ isBest, won: game.won || isBest });
    $('share-btn').focus({ preventScroll: true });
  }

  // ---------- 조작 ----------
  function pointerX(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * G.W;
  }

  function bindControls() {
    const area = $('board-area');
    area.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button') || !game || game.over || paused) return;
      event.preventDefault();
      G.setPaddle(game, pointerX(event));
      if (game.ball.stuck && G.launch(game)) MaeilFx.play('tap');
      try { area.setPointerCapture(event.pointerId); } catch {}
    });
    area.addEventListener('pointermove', (event) => {
      if (!game || game.over || paused || event.target.closest('button')) return;
      // 마우스는 누르지 않아도 따라오고, 터치는 누른 채 움직일 때만
      if (event.pointerType !== 'mouse' && event.buttons === 0) return;
      G.setPaddle(game, pointerX(event));
    });
    document.addEventListener('keydown', (event) => {
      if ($('game-screen').hidden || !game || game.over || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (key === 'Escape' || key === 'p' || key === 'P') {
        event.preventDefault();
        if (!event.repeat) (paused ? resume() : pause());
      } else if (key === 'ArrowLeft' || key === 'a') { event.preventDefault(); keyDir = -1; }
      else if (key === 'ArrowRight' || key === 'd') { event.preventDefault(); keyDir = 1; }
      else if (key === ' ' || key === 'ArrowUp') {
        event.preventDefault();
        if (paused) resume();
        else if (game.ball.stuck && G.launch(game)) MaeilFx.play('tap');
      }
    });
    document.addEventListener('keyup', (event) => {
      if ((event.key === 'ArrowLeft' || event.key === 'a') && keyDir < 0) keyDir = 0;
      if ((event.key === 'ArrowRight' || event.key === 'd') && keyDir > 0) keyDir = 0;
    });
  }

  function init() {
    canvas = $('canvas');
    ctx = canvas.getContext('2d');
    M.bindSettingButtons();
    picker = MaeilStart.setup({
      id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: c.note })),
      bestText: (key) => (loadStats()[key]?.best ? `내 최고 ${fmt(loadStats()[key].best)}점` : ''),
      onStart: (key) => start(G.create(key)),
      onDaily: startDaily,
    });
    bindControls();
    $('continue-btn').addEventListener('click', () => { const s = loadGame(); if (s) start(s, { resumePaused: true }); else renderStart(); });
    $('home-btn').addEventListener('click', () => { if (game?.over) finish(); else { saveGame(); renderStart(); } });
    $('pause-btn').addEventListener('click', () => (paused ? resume() : pause()));
    $('resume-btn').addEventListener('click', resume);
    $('again-btn').addEventListener('click', () => (game.daily ? startDaily() : start(G.create(game.difficulty))));
    $('result-home-btn').addEventListener('click', renderStart);
    $('share-btn').addEventListener('click', () => M.share({
      title: '벽돌깨기 — 매일게임',
      text: `[매일게임 벽돌깨기] ${label(game)} · ${fmt(game.score)}점${game.won ? ' · 모두 깼어요!' : ''}`,
      url: M.pageUrl('bricks/'),
    }));
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (game?.over && !$('game-screen').hidden) finish(); else pause(); }
    });
    window.addEventListener('pagehide', () => { if (game?.over && !$('game-screen').hidden) finish(); stopLoop(); saveGame(); });
    renderStart();
    updateSummary();
    MaeilStart.handleDailyLink(startDaily);
    M.registerOffline('../');
  }

  init();
})();
