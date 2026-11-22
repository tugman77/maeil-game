// 2048 화면 그리기와 밀기·키보드 처리. 규칙은 logic.js, 공통 기능은 ../common/core.js.
(() => {
  const M = MaeilGame;
  const G = Game2048;
  const ID = '2048';
  const KEYS = {
    game: 'maeil-game.2048.game.v1',
    stats: 'maeil-game.2048.stats.v1', // { easy: { played, best, maxTile }, ..., daily: {...} }
    daily: 'maeil-game.2048.daily.v1', // { date, score, maxTile } 그날 가장 좋은 점수
  };
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ko-KR');

  let game = null;
  let picker = null; // 시작 화면(난이도 선택·오늘의 도전) — common/start.js
  const slots = [];
  let layer = null;
  let tileAt = [];
  let animTimer = 0;
  let pending = {};
  const SLIDE_MS = 105; // 타일이 미끄러지는 시간(ms)

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
    // 최고 점수만. ('오늘 완료'는 게임 목록이 출석 기록으로 따로 표시한다)
    const stats = loadStats();
    const best = Math.max(0, ...Object.values(stats).map((s) => s.best || 0));
    if (best > 0) M.setSummary(ID, `최고 ${fmt(best)}점`);
  }

  // ---------- 화면 전환 ----------
  function showScreen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function renderStart() {
    const today = M.todayKey();
    const daily = loadDailyResult(today);
    picker.setDaily(daily
      ? `${M.dateLabel(today)} · 완료 ✓ ${fmt(daily.score)}점`
      : `${M.dateLabel(today)} · 모두 같은 숫자가 나와요`, Boolean(daily));

    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) $('continue-info').textContent = `${label(saved)} · ${fmt(saved.score)}점`;
    picker.refresh();
    showScreen('start-screen');
  }

  // ---------- 게임 ----------
  // 판: 바닥 칸 16개(빈 자리) + 그 위에 떠서 움직이는 숫자 타일 층
  function buildBoard() {
    const board = $('board');
    for (let i = 0; i < G.SIZE * G.SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.setAttribute('role', 'gridcell');
      board.appendChild(slot);
      slots.push(slot);
    }
    layer = document.createElement('div');
    layer.className = 'layer';
    layer.setAttribute('aria-hidden', 'true');
    board.appendChild(layer);
  }

  function placeTile(el, index) {
    el.style.setProperty('--x', index % G.SIZE);
    el.style.setProperty('--y', Math.floor(index / G.SIZE));
  }

  function makeTile(value, index) {
    const el = document.createElement('div');
    const digits = String(value).length;
    el.className = `tile ${value > 2048 ? 'vbig' : `v${value}`}${digits >= 3 ? ` d${Math.min(digits, 5)}` : ''}`;
    el.textContent = value;
    placeTile(el, index);
    return el;
  }

  function start(state) {
    game = state;
    M.markPlayed(ID);
    saveGame();
    $('game-label').textContent = label(game);
    showScreen('game-screen');
    render();
  }

  function startDaily() {
    const today = M.todayKey();
    const saved = loadGame();
    if (saved && saved.daily === today) {
      start(saved);
      return;
    }
    start(G.create(G.DAILY_DIFFICULTY, { daily: today, seedText: `maeil-2048:${today}` }));
  }

  function render(effects = {}) {
    clearTimeout(animTimer);
    animTimer = 0;
    const stats = loadStats();
    tileAt = new Array(G.SIZE * G.SIZE).fill(null);
    const els = [];
    game.cells.forEach((value, i) => {
      slots[i].setAttribute('aria-label', value ? String(value) : '빈칸');
      if (!value) return;
      const el = makeTile(value, i);
      if (i === effects.spawned) el.classList.add('new');
      if (effects.merged?.includes(i)) el.classList.add('merged');
      tileAt[i] = el;
      els.push(el);
    });
    layer.replaceChildren(...els);
    $('score').textContent = fmt(game.score);
    $('best').textContent = fmt(Math.max(game.score, stats[statKey(game)]?.best || 0));
    $('undo-btn').disabled = game.undoLeft <= 0 || game.history.length === 0;
    $('undo-btn').textContent = game.daily || G.DIFFICULTIES[game.difficulty].undo === 0
      ? '↶ 되돌리기 없음'
      : `↶ 되돌리기 ${game.undoLeft}`;
    $('restart-btn').hidden = Boolean(game.daily);
  }

  // 밀기: 타일이 0.1초 동안 미끄러져 간 뒤, 합쳐진 타일이 톡 튀고 새 타일이 나타난다.
  function doMove(direction) {
    if (!game || game.over || $('game-screen').hidden) return;
    if (animTimer) render(pending); // 앞의 움직임이 끝나기 전에 또 밀면 바로 마무리하고 이어서
    const result = G.move(game, direction);
    if (!result.moved) return;
    pending = result;
    result.moves.forEach(({ from, to }) => { if (tileAt[from]) placeTile(tileAt[from], to); });
    animTimer = setTimeout(() => render(result), SLIDE_MS);
    $('score').textContent = fmt(game.score);
    if (result.gained) floatScore(result.gained);

    if (result.merged.length) {
      const top = Math.max(...result.merged.map((i) => game.cells[i]));
      MaeilFx.play('merge', { level: Math.log2(top) - 1 });
    } else {
      MaeilFx.play('slide');
    }
    if (result.reachedGoal) {
      M.showToast('🎉 2048 달성! 계속해서 더 큰 숫자에 도전해 보세요');
      MaeilFx.play('success');
      MaeilFx.buzz([20, 40, 20]);
    }
    if (game.over) {
      setTimeout(finish, 650);
    } else {
      saveGame();
    }
  }

  // 점수 옆에 '+8'이 떠올랐다 사라진다
  function floatScore(gained) {
    const box = $('score').parentElement;
    const tag = document.createElement('span');
    tag.className = 'score-float';
    tag.textContent = `+${fmt(gained)}`;
    box.appendChild(tag);
    setTimeout(() => tag.remove(), 750);
  }

  function undoMove() {
    if (game && G.undo(game)) {
      render();
      saveGame();
    }
  }

  // 게임이 끝났거나 그만하기를 누르면 기록을 남기고 결과 화면으로 간다.
  function finish() {
    if (!game) return;
    game.over = true;
    clearGame();
    const key = statKey(game);
    const stats = loadStats();
    const entry = stats[key] || { played: 0, best: 0, maxTile: 0 };
    const previous = entry.best;
    const isBest = game.score > previous;
    stats[key] = {
      played: entry.played + 1,
      best: Math.max(previous, game.score),
      maxTile: Math.max(entry.maxTile, G.maxTile(game)),
    };
    M.write(KEYS.stats, stats);
    if (game.daily) {
      const before = loadDailyResult(game.daily);
      if (!before || game.score > before.score) M.write(KEYS.daily, { date: game.daily, score: game.score, maxTile: G.maxTile(game) });
      M.recordDaily(ID, game.daily);
    }
    updateSummary();
    showResult(isBest && game.score > 0, previous);
  }

  function showResult(isBest, previous) {
    const top = G.maxTile(game);
    $('result-emoji').textContent = game.won ? '🏆' : '🎉';
    $('result-title').textContent = game.won ? '2048 성공!' : '게임 끝!';
    $('result-sub').textContent = label(game);
    $('result-score').textContent = fmt(game.score);
    $('result-detail').textContent = `가장 큰 숫자 ${fmt(top)} · ${fmt(game.moves)}번 밀기`;
    const best = $('result-best');
    best.classList.toggle('new', isBest);
    best.textContent = isBest
      ? (previous ? `🏆 새 최고 점수! (이전 ${fmt(previous)})` : '🏆 첫 기록이 저장됐어요!')
      : `최고 점수 ${fmt(loadStats()[statKey(game)].best)}`;
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '새 게임';
    showScreen('result-screen');
    MaeilFx.countUp($('result-score'), game.score, fmt);
    MaeilFx.celebrate({ isBest, won: game.won });
    $('share-btn').focus();
  }

  function share() {
    const what = game.daily ? `${M.dateLabel(game.daily)} 오늘의 도전에서` : `${G.DIFFICULTIES[game.difficulty].label} 난이도에서`;
    M.share({
      title: '2048 — 매일게임',
      text: `[매일게임 2048] ${what} ${fmt(game.score)}점! (최대 ${fmt(G.maxTile(game))}) 🎉\n같이 해봐요 👉`,
      url: M.pageUrl('2048/'),
    });
  }

  // ---------- 조작: 밀기·방향키 ----------
  function bindSwipe() {
    const area = $('board-area');
    let startX = 0;
    let startY = 0;
    let tracking = false;
    area.addEventListener('pointerdown', (event) => {
      tracking = true;
      startX = event.clientX;
      startY = event.clientY;
    });
    const end = (event) => {
      if (!tracking) return;
      tracking = false;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
      else doMove(dy > 0 ? 'down' : 'up');
    };
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', () => { tracking = false; });
    // 판 위에서 밀 때 화면이 같이 움직이지 않게 한다.
    area.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  }

  function handleKey(event) {
    if ($('game-screen').hidden || event.altKey || event.metaKey || event.ctrlKey) return;
    const keys = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
    };
    const direction = keys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (direction) {
      event.preventDefault();
      doMove(direction);
    } else if (event.key === 'z' || event.key === 'Backspace') {
      undoMove();
    }
  }

  // 실수로 누르기 쉬운 버튼(새로·그만하기)은 두 번 눌러야 실행한다. (확인 창은 쓰지 않는다)
  function confirmTap(button, askText, action) {
    let armed = false;
    let timer = 0;
    const original = button.textContent;
    const reset = () => { armed = false; button.textContent = original; button.classList.remove('armed'); };
    button.addEventListener('click', () => {
      if (armed) {
        clearTimeout(timer);
        reset();
        action();
        return;
      }
      armed = true;
      button.textContent = askText;
      button.classList.add('armed');
      timer = setTimeout(reset, 3000);
    });
  }

  function init() {
    M.bindSettingButtons();
    buildBoard();
    bindSwipe();
    picker = MaeilStart.setup({
      id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: c.note })),
      bestText: (key) => { const best = loadStats()[key]?.best; return best ? `내 최고 ${fmt(best)}점` : ''; },
      onStart: (key) => start(G.create(key)),
      onDaily: startDaily,
    });
    $('continue-btn').addEventListener('click', () => { const saved = loadGame(); if (saved) start(saved); else renderStart(); });
    $('home-btn').addEventListener('click', () => { saveGame(); renderStart(); });
    $('undo-btn').addEventListener('click', undoMove);
    confirmTap($('restart-btn'), '한 번 더 누르면 새로 시작', () => start(G.create(game.difficulty)));
    confirmTap($('end-btn'), '한 번 더 누르면 끝내기', finish);
    $('share-btn').addEventListener('click', share);
    $('again-btn').addEventListener('click', () => (game.daily ? startDaily() : start(G.create(game.difficulty))));
    $('result-home-btn').addEventListener('click', renderStart);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('pagehide', saveGame);
    renderStart();
    updateSummary();
    MaeilStart.handleDailyLink(startDaily);
    M.registerOffline('../');
  }

  init();
})();
