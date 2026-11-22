// 게임 선택 화면: games.json을 읽어 게임 카드(썸네일)를 만들고, 오늘의 도전 도장판·연속 출석을 보여 준다.
// 새 게임은 games.json에 한 줄 추가하고 status를 "ready"로 바꾸면 카드가 생긴다("soon"이면 '곧 만나요'). 썸네일은 common/thumbs.js.
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
    if (text && !text.includes('✓')) return text.replace(/^최고 /, '내 최고 ');
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
    return played.length ? `내 최고 ${M.formatTime(stats[played[0]].best)} (${labels[played[0]]})` : '';
  }

  // 오늘의 도전: 제목 한 줄(완료 개수·연속 출석) + 도장판. 도장을 누르면 그 게임의 오늘의 도전이 바로 시작된다(#daily).
  function renderToday(ready, today) {
    const daily = ready.filter((game) => game.daily);
    const doneCount = daily.filter((game) => M.dailyDone(game.id, today)).length;
    $('today-date').textContent = M.dateLabel(today);
    $('today-count').textContent = `${doneCount}/${daily.length} 완료`;
    $('today-count').classList.toggle('all', doneCount === daily.length && daily.length > 0);
    const streak = M.currentStreak(today);
    $('streak').textContent = streak > 0 ? `🔥 ${streak}일 연속` : '';

    $('stamps').replaceChildren(...daily.map((game) => {
      const done = M.dailyDone(game.id, today);
      const li = el('li');
      const a = el('a', `stamp${done ? ' done' : ''}`);
      a.href = `${game.path}#daily`;
      a.append(el('span', 'stamp-mark', done ? '✓' : ''), el('span', '', game.short || game.name));
      a.setAttribute('aria-label', `${game.name} 오늘의 도전 ${done ? '완료, 다시 하기' : '시작하기'}`);
      li.append(a);
      return li;
    }));
  }

  // 플레이 가능한 게임 카드: 썸네일(완료·최근 표시) → 이름 → 설명(넓은 화면) → 내 최고(보조) → 플레이하기 →
  function card(game, summaries, today, recentId) {
    const li = el('li');
    const a = el('a', 'game-card');
    a.href = game.path;

    const thumb = el('span', `thumb thumb-${game.id}`);
    thumb.innerHTML = GameThumbs.render(game); // 우리 코드가 만든 고정 SVG
    const tags = el('span', 'thumb-tags');
    if (game.daily && M.dailyDone(game.id, today)) tags.append(el('span', 'tag tag-done', '✓ 오늘 완료'));
    if (game.id === recentId) tags.append(el('span', 'tag', '최근'));
    if (tags.childNodes.length) thumb.append(tags);

    const body = el('span', 'card-body');
    const record = recordText(game, summaries);
    body.append(
      el('strong', 'card-name', game.name),
      el('span', 'card-desc', game.desc),
      el('span', 'card-record', record || ' '), // 기록이 없어도 줄을 비워 두어 '플레이하기' 위치를 맞춘다
      el('span', 'card-play', '플레이하기 →'),
    );
    a.setAttribute('aria-label', `${game.name}${record ? `, ${record}` : ''}, 플레이하기`);
    a.append(thumb, body);
    li.append(a);
    return li;
  }

  // 출시 예정: 작은 가로 카드 + '출시 예정' 배지 (누를 수 없음)
  function soonCard(game) {
    const li = el('li', 'soon-card');
    const thumb = el('span', `soon-thumb thumb-${game.id}`);
    thumb.innerHTML = GameThumbs.render(game);
    const body = el('span', 'soon-body');
    body.append(el('strong', '', game.name), el('span', 'soon-desc', game.desc));
    li.append(thumb, body, el('span', 'badge-soon', '출시 예정'));
    return li;
  }

  function render(games) {
    const today = M.todayKey();
    const summaries = M.loadSummaries();
    const recentId = M.recentGame();
    const ready = games.filter((game) => game.status === 'ready');
    const soon = games.filter((game) => game.status !== 'ready');
    // 최근 한 게임을 맨 앞에 (도장판은 games.json 순서 그대로 — 매일 같은 자리)
    const ordered = ready.slice().sort((a, b) => (b.id === recentId) - (a.id === recentId));
    $('game-grid').replaceChildren(...ordered.map((game) => card(game, summaries, today, recentId)));
    $('soon-list').replaceChildren(...soon.map(soonCard));
    $('soon-wrap').hidden = soon.length === 0;
    renderToday(ready, today);
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
