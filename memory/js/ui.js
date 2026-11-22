// 카드 짝맞추기 화면 그리기·타이머·일시정지. 규칙은 logic.js, 공통 기능은 ../common/core.js.
(() => {
  const M = MaeilGame;
  const G = MemoryGame;
  const ID = 'memory';
  const KEYS = {
    game: 'maeil-game.memory.game.v1',
    stats: 'maeil-game.memory.stats.v1', // { easy: { played, best(초), bestAttempts }, ..., daily: {...} }
    daily: 'maeil-game.memory.daily.v1', // { date, seconds, attempts } 그날 가장 빠른 기록
  };
  const MISS_SHOW_MS = 900; // 틀린 두 장을 보여 주는 시간
  const $ = (id) => document.getElementById(id);

  let game = null;
  let cards = [];
  let paused = false;
  let timerId = 0;
  let lastTick = 0;
  let missTimer = 0;

  // ---------- 저장 ----------
  const loadStats = () => M.read(KEYS.stats) || {};
  function loadGame() {
    const saved = M.read(KEYS.game);
    return G.isValid(saved) && !G.isDone(saved) ? saved : null;
  }
  const saveGame = () => { if (game && !G.isDone(game)) M.write(KEYS.game, game); };
  const clearGame = () => { try { localStorage.removeItem(KEYS.game); } catch {} };
  function loadDailyResult(date) {
    const saved = M.read(KEYS.daily);
    return saved && saved.date === date ? saved : null;
  }
  const statKey = (state) => (state.daily ? 'daily' : state.difficulty);
  const label = (state) => (state.daily ? `📅 ${M.dateLabel(state.daily)} 오늘의 도전` : `${G.DIFFICULTIES[state.difficulty].label} · ${G.DIFFICULTIES[state.difficulty].pairs}쌍`);

  function updateSummary() {
    // 가장 많이 한 난이도의 최고 기록만. ('오늘 완료'는 게임 목록이 출석 기록으로 따로 표시한다)
    const stats = loadStats();
    const played = Object.keys(G.DIFFICULTIES).filter((key) => Number.isFinite(stats[key]?.best))
      .sort((a, b) => stats[b].played - stats[a].played);
    if (played.length) M.setSummary(ID, `최고 ${M.formatTime(stats[played[0]].best)} (${G.DIFFICULTIES[played[0]].label})`);
  }

  // ---------- 화면 ----------
  function showScreen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function renderStart() {
    stopTimer();
    const today = M.todayKey();
    const daily = loadDailyResult(today);
    const info = $('daily-info');
    info.classList.toggle('done', Boolean(daily));
    info.textContent = daily
      ? `${M.dateLabel(today)} · 완료 ✓ ${M.formatTime(daily.seconds)} · 시도 ${daily.attempts}번`
      : `${M.dateLabel(today)} · 모두 같은 배치 (8쌍)`;

    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    if (saved) $('continue-info').textContent = `${label(saved)} · ${G.matchedPairs(saved)}쌍 찾음 · ${M.formatTime(saved.elapsed)}`;

    const stats = loadStats();
    $('difficulty-list').replaceChildren(...Object.entries(G.DIFFICULTIES).map(([key, config]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'difficulty-btn';
      button.innerHTML = '<span></span><small></small><small class="best"></small>';
      button.children[0].textContent = config.label;
      button.children[1].textContent = `카드 ${config.pairs * 2}장 (${config.pairs}쌍)`;
      button.children[2].textContent = Number.isFinite(stats[key]?.best) ? `최고 ${M.formatTime(stats[key].best)}` : '';
      button.addEventListener('click', () => start(G.create(key)));
      return button;
    }));
    showScreen('start-screen');
  }

  // ---------- 게임 ----------
  function start(state) {
    game = state;
    game.open = []; // 이어하기 때 열려 있던 틀린 카드는 덮고 시작
    paused = false;
    M.markPlayed(ID);
    saveGame();
    buildBoard();
    $('pause-overlay').hidden = true;
    showScreen('game-screen');
    render();
    if (game.started) startTimer();
  }

  function startDaily() {
    const today = M.todayKey();
    const saved = loadGame();
    if (saved && saved.daily === today) {
      start(saved);
      return;
    }
    start(G.create(G.DAILY_DIFFICULTY, { daily: today, random: M.dailyRandom(ID, today) }));
  }

  function buildBoard() {
    const board = $('board');
    const { cols } = G.DIFFICULTIES[game.difficulty];
    board.style.setProperty('--cols', cols);
    board.style.setProperty('--rows', Math.ceil(game.cards.length / cols));
    cards = game.cards.map((card, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card';
      const face = document.createElement('span');
      face.className = 'face';
      face.textContent = card.symbol;
      face.setAttribute('aria-hidden', 'true');
      button.append(face);
      button.addEventListener('click', () => onFlip(i));
      return button;
    });
    board.replaceChildren(...cards);
  }

  function render() {
    const missing = game.open.length === 2;
    game.cards.forEach((card, i) => {
      const el = cards[i];
      const open = game.open.includes(i);
      el.classList.toggle('open', open);
      el.classList.toggle('matched', card.matched);
      el.classList.toggle('miss', open && missing);
      el.setAttribute('aria-label', card.matched ? `${i + 1}번 카드, ${card.symbol} 짝 찾음`
        : open ? `${i + 1}번 카드, ${card.symbol}` : `${i + 1}번 카드, 뒤집힘`);
    });
    $('attempts').textContent = game.attempts;
    $('game-label').textContent = `${label(game)} · 짝 ${G.matchedPairs(game)}/${G.DIFFICULTIES[game.difficulty].pairs}`;
    $('timer').textContent = M.formatTime(game.elapsed);
  }

  function onFlip(index) {
    if (paused || !game) return;
    clearTimeout(missTimer);
    const wasStarted = game.started;
    const result = G.flip(game, index);
    if (result === 'ignored') return;
    if (!wasStarted) startTimer();
    render();
    if (result === 'miss') {
      missTimer = setTimeout(() => { G.hideMiss(game); render(); }, MISS_SHOW_MS);
    }
    if (result === 'done') {
      setTimeout(finish, 500);
      stopTimer();
    } else {
      saveGame();
    }
  }

  // ---------- 타이머·일시정지 ----------
  function startTimer() {
    stopTimer();
    lastTick = Date.now();
    timerId = setInterval(() => {
      const now = Date.now();
      game.elapsed += (now - lastTick) / 1000;
      lastTick = now;
      $('timer').textContent = M.formatTime(game.elapsed);
    }, 250);
  }

  function stopTimer() {
    if (timerId && game) game.elapsed += (Date.now() - lastTick) / 1000;
    clearInterval(timerId);
    timerId = 0;
  }

  function pause() {
    if (paused || $('game-screen').hidden) return;
    paused = true;
    stopTimer();
    $('pause-overlay').hidden = false;
    saveGame();
  }

  function resume() {
    paused = false;
    $('pause-overlay').hidden = true;
    if (game.started) startTimer();
  }

  // ---------- 끝 ----------
  function finish() {
    clearGame();
    const seconds = Math.floor(game.elapsed);
    const key = statKey(game);
    const stats = loadStats();
    const entry = stats[key] || { played: 0 };
    const previous = entry.best;
    const isBest = !Number.isFinite(previous) || seconds < previous;
    stats[key] = {
      played: entry.played + 1,
      best: isBest ? seconds : previous,
      bestAttempts: Math.min(entry.bestAttempts ?? Infinity, game.attempts),
    };
    M.write(KEYS.stats, stats);
    if (game.daily) {
      const before = loadDailyResult(game.daily);
      if (!before || seconds < before.seconds) M.write(KEYS.daily, { date: game.daily, seconds, attempts: game.attempts });
      M.recordDaily(ID, game.daily);
    }
    updateSummary();

    $('result-sub').textContent = label(game);
    $('result-time').textContent = M.formatTime(seconds);
    const pairs = G.DIFFICULTIES[game.difficulty].pairs;
    $('result-detail').textContent = `시도 ${game.attempts}번 · 정확도 ${Math.round((pairs / game.attempts) * 100)}%`;
    const best = $('result-best');
    best.classList.toggle('new', isBest);
    best.textContent = isBest
      ? (Number.isFinite(previous) ? `🏆 새 최고 기록! (이전 ${M.formatTime(previous)})` : '🏆 첫 기록이 저장됐어요!')
      : `최고 기록 ${M.formatTime(previous)}`;
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '새 게임';
    showScreen('result-screen');
    $('share-btn').focus();
  }

  function share() {
    const what = game.daily ? `${M.dateLabel(game.daily)} 오늘의 도전을` : `${G.DIFFICULTIES[game.difficulty].label} 난이도를`;
    M.share({
      title: '카드 짝맞추기 — 매일게임',
      text: `[매일게임 카드 짝맞추기] ${what} ${M.formatTimeKorean(game.elapsed)}, ${game.attempts}번 만에 끝냈어요! 🧠\n같이 해봐요 👉`,
      url: M.pageUrl('memory/'),
    });
  }

  function init() {
    M.bindSettingButtons();
    $('daily-btn').addEventListener('click', startDaily);
    $('continue-btn').addEventListener('click', () => { const saved = loadGame(); if (saved) start(saved); else renderStart(); });
    $('home-btn').addEventListener('click', () => { stopTimer(); saveGame(); renderStart(); });
    $('pause-btn').addEventListener('click', pause);
    $('resume-btn').addEventListener('click', resume);
    $('share-btn').addEventListener('click', share);
    $('again-btn').addEventListener('click', () => (game.daily ? startDaily() : start(G.create(game.difficulty))));
    $('result-home-btn').addEventListener('click', renderStart);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('game-screen').hidden) (paused ? resume() : pause());
    });
    // 다른 앱으로 가면 자동 일시정지(시간이 흐르지 않게)
    document.addEventListener('visibilitychange', () => { if (document.hidden && game?.started && !$('game-screen').hidden) pause(); });
    window.addEventListener('pagehide', () => { stopTimer(); saveGame(); });
    // 뒤로 가기 등으로 돌아오면 멈춘 시간을 일시정지 화면으로 보여 준다.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && game?.started && !$('game-screen').hidden) { paused = false; pause(); }
    });
    renderStart();
    updateSummary();
    M.registerOffline('../');
  }

  init();
})();
