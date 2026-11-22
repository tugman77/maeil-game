// 게임 선택 화면: games.json을 읽어 게임 카드를 만들고, 오늘의 도전·연속 출석·게임별 기록을 보여 준다.
// 새 게임은 games.json에 한 줄 추가하고 status를 "ready"로 바꾸면 카드가 생긴다.
(() => {
  const M = MaeilGame;
  const $ = (id) => document.getElementById(id);

  // 매일 스도쿠 시절 기록만 있고 아직 새 사이트에서 스도쿠를 열지 않은 사람에게도 기록을 보여 준다.
  function legacySudokuSummary() {
    const stats = M.read('maeil-sudoku.stats.v1');
    if (!stats || typeof stats !== 'object') return '';
    const labels = { easy: '쉬움', medium: '보통', hard: '어려움', expert: '매우 어려움' };
    const played = Object.keys(labels).filter((key) => Number.isFinite(stats[key]?.best))
      .sort((a, b) => stats[b].solved - stats[a].solved);
    return played.length ? `최고 ${M.formatTime(stats[played[0]].best)} (${labels[played[0]]})` : '';
  }

  function renderToday(readyGames) {
    const today = M.todayKey();
    $('today-date').textContent = `📅 ${M.dateLabel(today)} 오늘의 도전`;
    const streak = M.currentStreak(today);
    $('streak').textContent = streak > 0 ? `🔥 ${streak}일 연속` : '';
    const dailyGames = readyGames.filter((game) => game.daily);
    const done = dailyGames.filter((game) => M.dailyDone(game.id, today)).length;
    $('today-progress').textContent = done === 0
      ? '오늘은 모두가 같은 판을 풀어요. 하나만 해도 출석!'
      : `오늘 ${dailyGames.length}개 중 ${done}개 완료 ✓${done < dailyGames.length ? ' · 하나 더 해 볼까요?' : ' · 다 했어요! 👏'}`;
  }

  function card(game, summaries, today) {
    const li = document.createElement('li');
    const ready = game.status === 'ready';
    const el = document.createElement(ready ? 'a' : 'div');
    el.className = `game-card${ready ? '' : ' soon'}`;
    if (ready) el.href = game.path;

    const icon = document.createElement('span');
    icon.className = 'game-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = game.icon;

    const body = document.createElement('span');
    body.className = 'game-body';
    const name = document.createElement('strong');
    name.className = 'game-name';
    name.textContent = game.name;
    const desc = document.createElement('span');
    desc.className = 'game-desc';
    desc.textContent = game.desc;
    body.append(name, desc);

    if (ready) {
      const record = summaries[game.id] || (game.id === 'sudoku' ? legacySudokuSummary() : '');
      const doneToday = game.daily && M.dailyDone(game.id, today);
      if (record || doneToday) {
        const meta = document.createElement('span');
        meta.className = 'game-meta';
        meta.textContent = doneToday && !record.includes('✓') ? `오늘 도전 완료 ✓${record ? ` · ${record}` : ''}` : record;
        body.append(meta);
      }
    }

    el.append(icon, body);
    if (ready) {
      const arrow = document.createElement('span');
      arrow.className = 'game-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '›';
      el.append(arrow);
    }
    li.append(el);
    return li;
  }

  function render(games) {
    const today = M.todayKey();
    const summaries = M.loadSummaries();
    const recent = M.recentGame();
    const ready = games.filter((game) => game.status === 'ready');
    // 최근 한 게임을 맨 위에
    ready.sort((a, b) => (b.id === recent) - (a.id === recent));
    const soon = games.filter((game) => game.status !== 'ready');

    $('game-list').replaceChildren(...ready.map((game) => card(game, summaries, today)));
    $('soon-list').replaceChildren(...soon.map((game) => card(game, summaries, today)));
    $('soon-wrap').hidden = soon.length === 0;
    renderToday(ready);
  }

  async function init() {
    M.bindSettingButtons();
    let games = [];
    try {
      const response = await fetch('games.json', { cache: 'no-cache' });
      games = await response.json();
    } catch {
      // 파일을 직접 열었거나 인터넷이 끊긴 경우: 최소한 스도쿠는 보여 준다.
      games = [{ id: 'sudoku', name: '스도쿠', desc: '1~9 숫자를 겹치지 않게 채우기', icon: '🔢', path: 'sudoku/', status: 'ready', daily: true }];
    }
    render(games);
    // 게임을 하고 뒤로 가기로 돌아왔을 때 기록을 새로 그린다.
    window.addEventListener('pageshow', (event) => { if (event.persisted) render(games); });
    M.registerOffline('./');
  }

  init();
})();
