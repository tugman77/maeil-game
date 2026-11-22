// 게임 선택 화면: games.json을 읽어 게임 카드(썸네일)를 만들고, 오늘의 도전 도장판·연속 출석·최근 게임을 보여 준다.
// 새 게임은 games.json에 한 줄 추가하고 status를 "ready"로 바꾸면 카드가 생긴다. 썸네일은 common/thumbs.js.
(() => {
  const M = MaeilGame;
  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // 게임별 최고 기록 한 줄. 예전 형식('오늘의 … ✓')은 날짜가 지나면 틀리므로 쓰지 않는다.
  function recordText(game, summaries) {
    const text = summaries[game.id];
    if (text && !text.includes('✓')) return text;
    if (game.id === 'sudoku') return legacySudokuSummary();
    return '';
  }

  // 매일 스도쿠 시절 기록만 있고 아직 새 사이트에서 스도쿠를 열지 않은 사람에게도 기록을 보여 준다.
  function legacySudokuSummary() {
    const stats = M.read('maeil-sudoku.stats.v1');
    if (!stats || typeof stats !== 'object') return '';
    const labels = { easy: '쉬움', medium: '보통', hard: '어려움', expert: '매우 어려움' };
    const played = Object.keys(labels).filter((key) => Number.isFinite(stats[key]?.best))
      .sort((a, b) => stats[b].solved - stats[a].solved);
    return played.length ? `최고 ${M.formatTime(stats[played[0]].best)} (${labels[played[0]]})` : '';
  }

  function renderToday(ready, today) {
    $('today-date').textContent = `📅 ${M.dateLabel(today)} 오늘의 도전`;
    const streak = M.currentStreak(today);
    $('streak').textContent = streak > 0 ? `🔥 ${streak}일 연속` : '';

    const daily = ready.filter((game) => game.daily);
    const doneCount = daily.filter((game) => M.dailyDone(game.id, today)).length;
    $('stamps').replaceChildren(...daily.map((game) => {
      const done = M.dailyDone(game.id, today);
      const li = el('li');
      const a = el('a', `stamp${done ? ' done' : ''}`);
      a.href = game.path;
      a.append(el('span', 'stamp-mark', done ? '✓' : ''), el('span', '', game.short || game.name));
      a.setAttribute('aria-label', `${game.name} 오늘의 도전 ${done ? '완료' : '아직 안 함'}`);
      li.append(a);
      return li;
    }));
    $('today-progress').textContent = doneCount === 0
      ? '모두가 같은 판을 풀어요. 하나만 해도 출석!'
      : doneCount < daily.length
        ? `${daily.length}개 중 ${doneCount}개 완료 · 도장을 다 채워 볼까요?`
        : '오늘 도장을 다 채웠어요! 👏';

    const recentId = M.recentGame();
    const recent = ready.find((game) => game.id === recentId);
    const link = $('recent-link');
    link.hidden = !recent;
    if (recent) {
      link.href = recent.path;
      link.textContent = `▶ 최근 한 게임: ${recent.name} 이어서 하기`;
    }
  }

  function card(game, summaries, today) {
    const ready = game.status === 'ready';
    const li = el('li');
    const root = el(ready ? 'a' : 'div', `game-card${ready ? '' : ' soon'}`);
    if (ready) root.href = game.path;

    const thumb = el('span', `thumb thumb-${game.id}`);
    thumb.innerHTML = GameThumbs.render(game); // 우리 코드가 만든 고정 SVG
    if (!ready) thumb.append(el('span', 'soon-ribbon', '곧 나와요'));

    const body = el('span', 'card-body');
    body.append(el('strong', 'card-name', game.name), el('span', 'card-desc', game.desc));
    if (ready) {
      const status = el('span', 'card-status');
      if (game.daily && M.dailyDone(game.id, today)) status.append(el('span', 'badge-done', '✓ 오늘 완료'));
      const record = recordText(game, summaries);
      if (record) status.append(el('span', 'card-record', record));
      if (!status.childNodes.length) status.append(el('span', 'card-new', '바로 시작 ›'));
      body.append(status);
    }
    root.append(thumb, body);
    li.append(root);
    return li;
  }

  function render(games) {
    const today = M.todayKey();
    const summaries = M.loadSummaries();
    const ready = games.filter((game) => game.status === 'ready');
    const soon = games.filter((game) => game.status !== 'ready');
    // 최근 한 게임을 맨 앞에, 준비 중인 게임은 맨 뒤에
    const recent = M.recentGame();
    const ordered = ready.slice().sort((a, b) => (b.id === recent) - (a.id === recent));
    $('game-grid').replaceChildren(...[...ordered, ...soon].map((game) => card(game, summaries, today)));
    renderToday(ready, today); // 도장판은 games.json 순서 그대로(매일 같은 자리)
  }

  async function init() {
    M.bindSettingButtons();
    let games = [];
    try {
      const response = await fetch('games.json', { cache: 'no-cache' });
      games = await response.json();
    } catch {
      // 파일을 직접 열었거나 인터넷이 끊긴 경우: 최소한 스도쿠는 보여 준다.
      games = [{ id: 'sudoku', short: '스도쿠', name: '스도쿠', desc: '1~9 숫자를 겹치지 않게 채우기', path: 'sudoku/', status: 'ready', daily: true }];
    }
    render(games);
    // 게임을 하고 뒤로 가기로 돌아왔을 때 기록을 새로 그린다.
    window.addEventListener('pageshow', (event) => { if (event.persisted) render(games); });
    M.registerOffline('./');
  }

  init();
})();
