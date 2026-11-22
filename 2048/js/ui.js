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
  const tiles = [];

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
    const info = $('daily-info');
    info.classList.toggle('done', Boolean(daily));
    info.textContent = daily
      ? `${M.dateLabel(today)} · 완료 ✓ ${fmt(daily.score)}점 (다시 하면 더 높은 점수만 남아요)`
      : `${M.dateLabel(today)} · 모두 같은 숫자가 나와요`;

    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    if (saved) $('continue-info').textContent = `${label(saved)} · ${fmt(saved.score)}점`;

    const stats = loadStats();
    $('difficulty-list').replaceChildren(...Object.entries(G.DIFFICULTIES).map(([key, config]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'difficulty-btn';
      button.innerHTML = '<span></span><small></small><small class="best"></small>';
      button.children[0].textContent = config.label;
      button.children[1].textContent = config.note;
      button.children[2].textContent = stats[key]?.best ? `최고 ${fmt(stats[key].best)}` : '';
      button.addEventListener('click', () => start(G.create(key)));
      return button;
    }));
    showScreen('start-screen');
  }

  // ---------- 게임 ----------
  function buildBoard() {
    const board = $('board');
    for (let i = 0; i < G.SIZE * G.SIZE; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'gridcell');
      board.appendChild(tile);
      tiles.push(tile);
    }
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
    const stats = loadStats();
    game.cells.forEach((value, i) => {
      const tile = tiles[i];
      const digits = String(value).length;
      tile.className = 'tile';
      if (value) {
        tile.classList.add(value > 2048 ? 'vbig' : `v${value}`);
        if (digits >= 3) tile.classList.add(`d${Math.min(digits, 5)}`);
      }
      if (i === effects.spawned) tile.classList.add('new');
      if (effects.merged?.includes(i)) tile.classList.add('merged');
      tile.textContent = value || '';
      tile.setAttribute('aria-label', value ? String(value) : '빈칸');
    });
    $('score').textContent = fmt(game.score);
    $('best').textContent = fmt(Math.max(game.score, stats[statKey(game)]?.best || 0));
    $('undo-btn').disabled = game.undoLeft <= 0 || game.history.length === 0;
    $('undo-btn').textContent = game.daily || G.DIFFICULTIES[game.difficulty].undo === 0
      ? '↶ 되돌리기 없음'
      : `↶ 되돌리기 ${game.undoLeft}`;
    $('restart-btn').hidden = Boolean(game.daily);
  }

  function doMove(direction) {
    if (!game || game.over || $('game-screen').hidden) return;
    const result = G.move(game, direction);
    if (!result.moved) return;
    render(result);
    if (result.reachedGoal) M.showToast('🎉 2048 달성! 계속해서 더 큰 숫자에 도전해 보세요');
    if (game.over) {
      setTimeout(finish, 450);
    } else {
      saveGame();
    }
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
    $('daily-btn').addEventListener('click', startDaily);
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
    M.registerOffline('../');
  }

  init();
})();
