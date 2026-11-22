// 지뢰찾기 화면 그리기·조작(열기/깃발 전환, PC 오른쪽 클릭)·타이머. 규칙은 logic.js.
(() => {
  const M = MaeilGame;
  const G = Minesweeper;
  const ID = 'minesweeper';
  const KEYS = {
    game: 'maeil-game.minesweeper.game.v1',
    stats: 'maeil-game.minesweeper.stats.v1', // { easy: { played, won, best(초) }, ..., daily: {...} }
    daily: 'maeil-game.minesweeper.daily.v1', // { date, won, seconds } 그날 가장 좋은 결과
  };
  const $ = (id) => document.getElementById(id);

  let game = null;
  let picker = null; // 시작 화면(난이도 선택·오늘의 도전) — common/start.js
  let cells = [];
  let flagMode = false;
  let paused = false;
  let timerId = 0;
  let lastTick = 0;
  let lastResult = null; // { isBest, previous }

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
  const label = (state) => {
    const config = G.DIFFICULTIES[state.difficulty];
    return state.daily ? `📅 ${M.dateLabel(state.daily)} 오늘의 도전` : `${config.label} · 지뢰 ${config.mines}개`;
  };

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
    let info = `${M.dateLabel(today)} · 모두 같은 판 (한 구역 열고 시작)`;
    if (daily?.won) info = `${M.dateLabel(today)} · 성공 ✓ ${M.formatTime(daily.seconds)}`;
    else if (daily) info = `${M.dateLabel(today)} · 참여 ✓ 다시 도전해 성공해 보세요`;
    picker.setDaily(info, Boolean(daily));

    const saved = loadGame();
    $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) $('continue-info').textContent = `${label(saved)} · ${M.formatTime(saved.elapsed)}`;
    picker.refresh();
    showScreen('start-screen');
  }

  // ---------- 게임 ----------
  function start(state) {
    game = state;
    paused = false;
    setMode(false);
    M.markPlayed(ID);
    saveGame();
    buildBoard();
    $('game-label').textContent = label(game);
    $('pause-overlay').hidden = true;
    $('pause-btn').textContent = '⏸ 정지';
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
    board.style.setProperty('--cols', game.cols);
    board.style.setProperty('--rows', game.rows);
    cells = game.revealed.map((_, i) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mcell';
      cell.setAttribute('role', 'gridcell');
      cell.addEventListener('click', () => act(i, flagMode ? 'flag' : 'open'));
      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        act(i, 'flag');
      });
      return cell;
    });
    board.replaceChildren(...cells);
  }

  function render() {
    const showMines = game.over;
    cells.forEach((cell, i) => {
      const open = game.revealed[i] === 1;
      const mine = game.mines && game.mines[i] === 1;
      const flag = game.flagged[i] === 1;
      const number = open && game.mines ? G.count(game, i) : 0;
      cell.className = 'mcell';
      let text = '';
      let aria = '닫힌 칸';
      if (open) {
        cell.classList.add('open');
        if (number) {
          cell.classList.add(`n${number}`);
          text = number;
          aria = `숫자 ${number}`;
        } else {
          aria = '빈칸';
        }
      } else if (showMines && mine && !flag) {
        cell.classList.add('open', 'mine');
        if (i === game.exploded) cell.classList.add('boom');
        text = '💣';
        aria = '지뢰';
      } else if (flag) {
        cell.classList.add('flag');
        text = '🚩';
        aria = '깃발';
        if (showMines && !mine) {
          cell.classList.add('wrong');
          aria = '잘못 꽂은 깃발';
        }
      }
      cell.textContent = text;
      const r = Math.floor(i / game.cols) + 1;
      const c = (i % game.cols) + 1;
      cell.setAttribute('aria-label', `${r}행 ${c}열, ${aria}`);
    });
    $('flags').textContent = G.flagsLeft(game);
    $('timer').textContent = M.formatTime(game.elapsed);
  }

  function act(i, kind) {
    if (paused || !game || game.over) return;
    const wasStarted = game.started;
    let result = 'ignored';
    if (kind === 'flag') {
      result = G.toggleFlag(game, i) ? 'flag' : 'ignored';
    } else if (game.revealed[i]) {
      result = G.chord(game, i);
    } else {
      result = G.reveal(game, i);
    }
    if (result === 'ignored') return;
    if (!wasStarted && game.started) startTimer();
    render();
    if (result === 'boom' || result === 'win') {
      stopTimer();
      render();
      setTimeout(() => finish(result === 'win'), result === 'win' ? 500 : 1100);
    } else {
      saveGame();
    }
  }

  function setMode(flag) {
    flagMode = flag;
    $('mode-open').setAttribute('aria-pressed', String(!flag));
    $('mode-flag').setAttribute('aria-pressed', String(flag));
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
    if (paused || $('game-screen').hidden || game.over) return;
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
  function finish(won) {
    clearGame();
    const seconds = Math.floor(game.elapsed);
    const key = statKey(game);
    const stats = loadStats();
    const entry = stats[key] || { played: 0, won: 0 };
    const previous = entry.best;
    const isBest = won && (!Number.isFinite(previous) || seconds < previous);
    stats[key] = {
      played: entry.played + 1,
      won: entry.won + (won ? 1 : 0),
      best: isBest ? seconds : previous,
    };
    M.write(KEYS.stats, stats);
    if (game.daily) {
      const before = loadDailyResult(game.daily);
      const better = !before || (won && (!before.won || seconds < before.seconds));
      if (better) M.write(KEYS.daily, { date: game.daily, won, seconds });
      M.recordDaily(ID, game.daily); // 성공하지 못해도 도전하면 출석
    }
    updateSummary();
    lastResult = { isBest, previous };
    showResult();
  }

  function showResult() {
    const { isBest, previous } = lastResult;
    const won = game.won;
    const stats = loadStats()[statKey(game)];
    $('result-emoji').textContent = won ? '🎉' : '💥';
    $('result-title').textContent = won ? '성공!' : '아쉬워요!';
    $('result-sub').textContent = label(game);
    $('result-label').textContent = won ? '걸린 시간' : '버틴 시간';
    $('result-time').textContent = M.formatTime(Math.floor(game.elapsed));
    const best = $('result-best');
    best.classList.toggle('new', isBest);
    if (isBest) best.textContent = Number.isFinite(previous) ? `🏆 새 최고 기록! (이전 ${M.formatTime(previous)})` : '🏆 첫 성공 기록!';
    else best.textContent = `성공 ${stats.won}번 / 도전 ${stats.played}번${Number.isFinite(stats.best) ? ` · 최고 ${M.formatTime(stats.best)}` : ''}`;
    $('share-btn').hidden = !won && !game.daily;
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : (won ? '새 게임' : '다시 도전');
    showScreen('result-screen');
  }

  // 결과 화면에서 끝난 판을 다시 본다. 위의 정지 버튼이 '결과 ▶'로 바뀐다.
  function viewBoard() {
    showScreen('game-screen');
    $('pause-btn').textContent = '결과 ▶';
    render();
  }

  function share() {
    const what = game.daily ? `${M.dateLabel(game.daily)} 오늘의 도전` : `${G.DIFFICULTIES[game.difficulty].label} 난이도`;
    const text = game.won
      ? `[매일게임 지뢰찾기] ${what}를 ${M.formatTimeKorean(Math.floor(game.elapsed))}에 성공했어요! 💣🚩`
      : `[매일게임 지뢰찾기] ${what}… 아깝게 실패했어요 💥 누가 성공하나 해 봐요!`;
    M.share({ title: '지뢰찾기 — 매일게임', text: `${text}\n같이 해봐요 👉`, url: M.pageUrl('minesweeper/') });
  }

  function init() {
    M.bindSettingButtons();
    picker = MaeilStart.setup({
      id: ID,
      difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: `${c.cols}×${c.rows} 판 · 지뢰 ${c.mines}개` })),
      bestText: (key) => { const s = loadStats()[key]; return Number.isFinite(s?.best) ? `내 최고 ${M.formatTime(s.best)} · 성공 ${s.won}/${s.played}번` : ''; },
      onStart: (key) => start(G.create(key)),
      onDaily: startDaily,
    });
    $('continue-btn').addEventListener('click', () => { const saved = loadGame(); if (saved) start(saved); else renderStart(); });
    $('home-btn').addEventListener('click', () => { stopTimer(); saveGame(); renderStart(); });
    $('pause-btn').addEventListener('click', () => (game?.over ? showResult() : pause()));
    $('resume-btn').addEventListener('click', resume);
    $('mode-open').addEventListener('click', () => setMode(false));
    $('mode-flag').addEventListener('click', () => setMode(true));
    $('view-btn').addEventListener('click', viewBoard);
    $('share-btn').addEventListener('click', share);
    $('again-btn').addEventListener('click', () => (game.daily ? startDaily() : start(G.create(game.difficulty))));
    $('result-home-btn').addEventListener('click', renderStart);
    document.addEventListener('keydown', (event) => {
      if ($('game-screen').hidden || !game || game.over) return;
      if (event.key === 'Escape') (paused ? resume() : pause());
      else if (event.key.toLowerCase() === 'f' || event.key === 'ㄹ') setMode(!flagMode);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game?.started && !game.over && !$('game-screen').hidden) pause();
    });
    window.addEventListener('pagehide', () => { stopTimer(); saveGame(); });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && game?.started && !game.over && !$('game-screen').hidden) { paused = false; pause(); }
    });
    renderStart();
    updateSummary();
    MaeilStart.handleDailyLink(startDaily);
    M.registerOffline('../');
  }

  init();
})();
