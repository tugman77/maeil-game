// 점프 러너 화면·조작. 규칙은 logic.js. 한 판이 짧아 이어하기는 없다(정지·다른 앱으로 가면 자동 일시정지).
// 조작: 화면(판)이나 [점프!] 버튼을 누르면 점프. PC는 스페이스·↑.
(() => {
  const M = MaeilGame;
  const G = Runner;
  const ID = 'runner';
  const KEYS = { stats: 'maeil-game.runner.stats.v1' };
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ko-KR');
  let game = null;
  let picker;
  let canvas;
  let ctx;
  let scale = 1;
  let running = false;
  let waiting = false;
  let paused = false;
  let finished = false;
  let frame = 0;
  let lastTime = 0;
  let finishTimer = 0;
  let squash = 0; // 착지 때 살짝 눌리는 모양

  const loadStats = () => { const s = M.read(KEYS.stats); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; };
  const label = (s) => (s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : `${G.DIFFICULTIES[s.difficulty].label} 난이도`);
  const hearts = (n) => (n > 0 ? '♥'.repeat(n) : '-');

  function updateSummary() {
    const best = Math.max(0, ...Object.values(loadStats()).map((s) => (Number.isFinite(s?.best) ? s.best : 0)));
    if (best) M.setSummary(ID, `최고 ${fmt(best)}m`);
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
    picker.setDaily(`${M.dateLabel(today)} · ${done ? `완료 ✓${daily?.best ? ` 최고 ${fmt(daily.best)}m` : ''}` : `같은 길 · ${G.DAILY_TARGET}m 달리면 완료`}`, done);
    $('continue-wrap').hidden = true;
    picker.refresh();
    showScreen('start-screen');
  }

  // ---------- 그리기 ----------
  function resize() {
    if (!canvas) return;
    const w = Math.floor(Math.min(520, window.innerWidth - 24));
    const h = Math.floor((w * G.H) / G.W);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = (w * dpr) / G.W;
    draw();
  }

  function draw() {
    if (!ctx || !game) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // 하늘
    const sky = ctx.createLinearGradient(0, 0, 0, G.GROUND);
    sky.addColorStop(0, dark ? '#1b2740' : '#bfe3f7');
    sky.addColorStop(1, dark ? '#2c3a52' : '#eef8fd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, G.W, G.H);
    // 먼 산·구름(천천히 지나감)
    ctx.fillStyle = dark ? '#33435e' : '#cfe8d6';
    for (let k = -1; k < 4; k++) {
      const x = k * 160 - ((game.x * 0.2) % 160);
      ctx.beginPath();
      ctx.moveTo(x, G.GROUND);
      ctx.quadraticCurveTo(x + 80, G.GROUND - 70, x + 160, G.GROUND);
      ctx.fill();
    }
    ctx.fillStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.9)';
    for (let k = -1; k < 4; k++) {
      const x = k * 140 - ((game.x * 0.35) % 140) + 30;
      const y = 30 + (k % 2) * 22;
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 16, y - 5, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 땅
    ctx.fillStyle = dark ? '#3d5a34' : '#7cc06a';
    ctx.fillRect(0, G.GROUND, G.W, 8);
    ctx.fillStyle = dark ? '#4b3a28' : '#c9a172';
    ctx.fillRect(0, G.GROUND + 8, G.W, G.H - G.GROUND - 8);
    ctx.fillStyle = dark ? '#5d4a35' : '#b38b5d';
    for (let k = -1; k < 14; k++) ctx.fillRect(k * 30 - (game.x % 30), G.GROUND + 16, 14, 3);
    // 장애물
    for (const o of game.obstacles) drawObstacle(o, o.x - game.x, dark);
    // 오늘의 도전 결승선
    if (game.daily && !game.goal) {
      const fx = G.DAILY_TARGET * G.METER - game.x + G.PX + G.PW;
      if (fx < G.W + 10) {
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = k % 2 ? '#1d2420' : '#ffffff';
          ctx.fillRect(fx, G.GROUND - 64 + k * 8, 6, 8);
        }
      }
    }
    // 병아리(부딪힌 뒤 잠깐 깜빡임)
    if (!(game.invincible > 0 && Math.floor(game.invincible * 10) % 2 === 0)) drawChick(G.PX, game.y, dark);
  }

  function drawObstacle(o, x, dark) {
    const s = G.OBSTACLES[o.type];
    const y = G.GROUND - s.h;
    if (o.type === 'rock' || o.type === 'rocks') {
      const n = o.type === 'rocks' ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const rx = x + k * (s.w / n);
        const rw = s.w / n;
        ctx.fillStyle = dark ? '#8a8f99' : '#8d939c';
        ctx.beginPath();
        ctx.moveTo(rx + 2, G.GROUND);
        ctx.quadraticCurveTo(rx, y + 4, rx + rw * 0.45, y);
        ctx.quadraticCurveTo(rx + rw, y + 2, rx + rw - 1, G.GROUND);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.fillRect(rx + rw * 0.3, y + 5, rw * 0.25, 3);
      }
    } else if (o.type === 'pot') {
      ctx.fillStyle = '#3f9a52';
      ctx.beginPath();
      ctx.ellipse(x + s.w / 2, y + 7, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8673d';
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 12);
      ctx.lineTo(x + s.w - 1, y + 12);
      ctx.lineTo(x + s.w - 4, G.GROUND);
      ctx.lineTo(x + 4, G.GROUND);
      ctx.fill();
    } else if (o.type === 'fence') {
      ctx.fillStyle = dark ? '#d9c39a' : '#a8743f';
      ctx.fillRect(x + 1, y, 5, s.h);
      ctx.fillRect(x + s.w - 6, y, 5, s.h);
      ctx.fillRect(x - 2, y + 9, s.w + 4, 5);
      ctx.fillRect(x - 2, y + 25, s.w + 4, 5);
    }
  }

  function drawChick(x, y, dark) {
    const w = G.PW;
    const h = G.PH;
    const sq = squash > 0 ? squash * 6 : 0;
    const cx = x + w / 2;
    const cy = y + h / 2 + sq / 2;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2 + sq / 2, h / 2 - sq / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 날개(점프 중엔 위로)
    ctx.fillStyle = '#f2b01e';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy + (game.onGround ? 3 : -3), 8, 5, game.onGround ? 0.3 : -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 눈·부리
    ctx.fillStyle = '#1d2420';
    ctx.beginPath();
    ctx.arc(cx + 7, cy - 5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef7d2d';
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy - 2);
    ctx.lineTo(cx + 21, cy + 1);
    ctx.lineTo(cx + 13, cy + 4);
    ctx.fill();
    // 다리(달리는 중엔 번갈아)
    if (game.onGround) {
      const t = Math.floor(game.x / 18) % 2;
      ctx.strokeStyle = '#ef7d2d';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - 3, y + h - 1); ctx.lineTo(cx - 3 + (t ? 3 : -2), G.GROUND);
      ctx.moveTo(cx + 4, y + h - 1); ctx.lineTo(cx + 4 + (t ? -2 : 3), G.GROUND);
      ctx.stroke();
    }
    if (dark) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; }
  }

  function hud() {
    $('distance').textContent = `${fmt(G.meters(game))}m`;
    $('lives').textContent = hearts(game.lives);
  }

  // ---------- 진행 ----------
  function start(state) {
    stopLoop();
    clearTimeout(finishTimer);
    game = state;
    finished = false;
    paused = false;
    waiting = true;
    M.markPlayed(ID);
    $('game-label').textContent = label(game);
    $('pause-title').textContent = '준비됐나요?';
    $('pause-note').textContent = game.daily ? `${G.DAILY_TARGET}m를 달리면 오늘의 도전 완료!` : '화면이나 [점프!]를 누르면 뛰어요';
    $('resume-btn').textContent = '출발하기';
    $('pause-overlay').hidden = false;
    $('pause-btn').textContent = '출발';
    showScreen('game-screen');
    resize();
    hud();
    $('resume-btn').focus({ preventScroll: true });
  }

  function startDaily() { start(G.create(G.DAILY_DIFFICULTY, { daily: M.todayKey() })); }

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
    const before = G.meters(game);
    const events = G.step(game, dt);
    if (squash > 0) squash = Math.max(0, squash - dt * 6);
    for (const e of events) {
      if (e.type === 'jump') MaeilFx.play('jump');
      else if (e.type === 'land') squash = 1;
      else if (e.type === 'hit') {
        MaeilFx.play('hurt');
        MaeilFx.buzz(50);
        MaeilFx.pulse($('board-area'), 'shake', 400);
      } else if (e.type === 'goal') reachGoal();
    }
    // 100m마다 작게 알림음
    if (Math.floor(G.meters(game) / 100) > Math.floor(before / 100)) MaeilFx.play('tap');
    draw();
    hud();
    if (game.over) {
      stopLoop();
      finishTimer = setTimeout(finish, 700);
      return;
    }
    if (running) frame = requestAnimationFrame(tick);
  }

  function reachGoal() {
    if (!M.dailyDone(ID, game.daily)) M.recordDaily(ID, game.daily);
    M.showToast('오늘의 도전 완료! 계속 달려 기록을 늘려 보세요');
    MaeilFx.play('success');
    MaeilFx.buzz(25);
  }

  function doJump() {
    if (!game || game.over || $('game-screen').hidden) return;
    if (paused) return;
    if (waiting) { resume(); }
    if (G.jump(game)) MaeilFx.play('jump');
  }

  function pause() {
    if (!game || game.over || paused || waiting || $('game-screen').hidden) return;
    paused = true;
    stopLoop();
    $('pause-title').textContent = '일시정지';
    $('pause-note').textContent = '준비되면 계속하기를 누르세요';
    $('resume-btn').textContent = '계속하기';
    $('pause-overlay').hidden = false;
    $('pause-btn').textContent = '계속';
  }

  function resume() {
    if (!game || game.over || (!paused && !waiting)) return;
    paused = false;
    waiting = false;
    $('pause-overlay').hidden = true;
    $('pause-btn').textContent = '정지';
    startLoop();
  }

  function finish() {
    if (finished || !game || !game.over) return;
    finished = true;
    stopLoop();
    const m = G.meters(game);
    const key = game.daily ? 'daily' : game.difficulty;
    const stats = loadStats();
    const e = stats[key] || {};
    const previous = Number.isFinite(e.best) ? e.best : 0;
    const isBest = m > previous;
    stats[key] = { played: (e.played || 0) + 1, best: Math.max(previous, m) };
    M.write(KEYS.stats, stats);
    updateSummary();
    $('result-title').textContent = game.goal ? '목표를 넘어 달렸어요!' : isBest ? '새 기록이에요!' : '다음엔 더 멀리!';
    $('result-sub').textContent = label(game);
    $('result-score').textContent = `${fmt(m)}m`;
    $('result-detail').textContent = `점프 ${fmt(game.jumps)}번 · ${M.formatTime(game.elapsed)}`;
    $('result-best').textContent = isBest ? (previous ? `새 최고 기록! 이전 ${fmt(previous)}m` : '첫 기록이 저장됐어요!') : `내 최고 ${fmt(stats[key].best)}m`;
    $('result-best').classList.toggle('new', isBest);
    $('result-daily').textContent = game.daily
      ? (game.goal ? '오늘의 도전 완료 ✓ 출석을 남겼어요' : `${G.DAILY_TARGET}m를 달리면 오늘의 도전 완료! (${fmt(G.DAILY_TARGET - m)}m 남았어요)`)
      : '장애물 바로 앞이 아니라 조금 일찍 누르면 넘기 쉬워요';
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '한 판 더';
    showScreen('result-screen');
    MaeilFx.countUp($('result-score'), m, (n) => `${fmt(n)}m`);
    MaeilFx.celebrate({ isBest, won: game.goal || isBest });
    $('share-btn').focus({ preventScroll: true });
  }

  function bindControls() {
    const area = $('board-area');
    area.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      event.preventDefault();
      doJump();
    });
    $('jump-btn').addEventListener('pointerdown', (event) => { event.preventDefault(); doJump(); });
    $('jump-btn').addEventListener('click', (event) => { if (event.detail === 0) doJump(); });
    document.addEventListener('keydown', (event) => {
      if ($('game-screen').hidden || !game || game.over || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (key === 'Escape' || key === 'p' || key === 'P') {
        event.preventDefault();
        if (!event.repeat) (paused || waiting ? resume() : pause());
      } else if (key === ' ' || key === 'ArrowUp' || key === 'w') {
        if (event.target.closest && event.target.closest('button') && !paused && !waiting && event.target.id !== 'jump-btn') return;
        event.preventDefault();
        if (!event.repeat) doJump();
      }
    });
  }

  function init() {
    canvas = $('canvas');
    ctx = canvas.getContext('2d');
    M.bindSettingButtons();
    picker = MaeilStart.setup({
      id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: c.note })),
      bestText: (key) => (loadStats()[key]?.best ? `내 최고 ${fmt(loadStats()[key].best)}m` : ''),
      onStart: (key) => start(G.create(key)),
      onDaily: startDaily,
    });
    bindControls();
    $('home-btn').addEventListener('click', () => { if (game?.over) finish(); else renderStart(); });
    $('pause-btn').addEventListener('click', () => (paused || waiting ? resume() : pause()));
    $('resume-btn').addEventListener('click', resume);
    $('again-btn').addEventListener('click', () => (game.daily ? startDaily() : start(G.create(game.difficulty))));
    $('result-home-btn').addEventListener('click', renderStart);
    $('share-btn').addEventListener('click', () => M.share({
      title: '점프 러너 — 매일게임',
      text: `[매일게임 점프 러너] ${label(game)} · ${fmt(G.meters(game))}m 달렸어요!`,
      url: M.pageUrl('runner/'),
    }));
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (game?.over && !$('game-screen').hidden) finish(); else pause(); }
    });
    window.addEventListener('pagehide', () => { if (game?.over && !$('game-screen').hidden) finish(); stopLoop(); });
    renderStart();
    updateSummary();
    MaeilStart.handleDailyLink(startDaily);
    M.registerOffline('../');
  }

  init();
})();
