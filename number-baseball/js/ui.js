(() => {
  const M = MaeilGame, G = NumberBaseball, ID = 'number-baseball';
  const KEY = { game: 'maeil-game.number-baseball.game.v1', stats: 'maeil-game.number-baseball.stats.v1', daily: 'maeil-game.number-baseball.daily.v1' };
  const $ = (id) => document.getElementById(id);
  let game = null, picker, slots = [], digits = [], paused = false, finished = false;
  let timer = 0, lastTick = 0, ticks = 0;
  const config = () => G.DIFFICULTIES[game.difficulty];
  const label = (s) => s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : `${G.DIFFICULTIES[s.difficulty].label} · ${G.DIFFICULTIES[s.difficulty].digits}자리`;
  function loadStats() {
    const s = M.read(KEY.stats); return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  }
  function loadGame() { const s = M.read(KEY.game); return G.isValid(s) && !G.isDone(s) ? s : null; }
  const save = () => { if (game && !finished && !G.isDone(game)) M.write(KEY.game, game); };
  const clearSave = () => { try { localStorage.removeItem(KEY.game); } catch {} };
  function recordOK(r) {
    return r && Number.isSafeInteger(r.attempts) && r.attempts > 0 && Number.isInteger(r.hints)
      && r.hints >= 0 && r.hints <= 3 && Number.isFinite(r.seconds) && r.seconds >= 0;
  }
  function better(a, b) {
    return !recordOK(b) || a.hints < b.hints || (a.hints === b.hints
      && (a.attempts < b.attempts || (a.attempts === b.attempts && a.seconds < b.seconds)));
  }
  const recordText = (r) => `${r.attempts}회 · 힌트 ${r.hints}회`;
  function summary() {
    const stats = loadStats();
    const keys = Object.keys(G.DIFFICULTIES).filter((k) => recordOK(stats[k]?.best))
      .sort((a, b) => (stats[b].played || 0) - (stats[a].played || 0));
    if (keys.length) M.setSummary(ID, `최고 ${stats[keys[0]].best.attempts}회 (${G.DIFFICULTIES[keys[0]].label} · 힌트 ${stats[keys[0]].best.hints})`);
  }
  function screen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((key) => { $(key).hidden = key !== id; });
    window.scrollTo(0, 0);
  }
  function message(text) { $('game-status').textContent = text; }
  function renderStart() {
    stopTimer();
    const day = M.todayKey(), result = M.read(KEY.daily), done = M.dailyDone(ID, day);
    picker.setDaily(done && result?.date === day && recordOK(result)
      ? `${M.dateLabel(day)} · 완료 ${result.attempts}회 · 힌트 ${result.hints}회`
      : `${M.dateLabel(day)} · 모두 같은 세 자리 정답`, done);
    const saved = loadGame(); $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) $('continue-info').textContent = `${label(saved)} · ${saved.guesses.length}회 시도`;
    picker.refresh(); screen('start-screen');
  }
  function start(state) {
    stopTimer(); game = state; paused = false; finished = false;
    M.markPlayed(ID); buildInput(); save();
    $('pause-overlay').hidden = true; screen('game-screen');
    message('서로 다른 숫자를 골라 정답을 추리해 보세요.'); render(true);
    if (game.started) startTimer();
    slots[game.cursor].focus();
  }
  function startDaily() {
    const day = M.todayKey(), saved = loadGame();
    start(saved?.daily === day ? saved : G.create(G.DAILY_DIFFICULTY, { daily: day, random: M.dailyRandom(ID, day) }));
  }
  function buildInput() {
    slots = Array.from({ length: config().digits }, (_, index) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'guess-slot';
      b.addEventListener('click', () => {
        if (paused || finished) return;
        game.cursor = index; render(); save();
      });
      return b;
    });
    $('guess-slots').replaceChildren(...slots);
    digits = [...'1234567890'].map((digit) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'digit-btn'; b.textContent = digit;
      b.dataset.digit = digit; b.setAttribute('aria-label', `숫자 ${digit}`);
      b.addEventListener('click', () => input(digit)); return b;
    });
    // 숫자 키는 익숙한 전화기 배열. 아래 행의 두 편집 버튼도 동일한 크기.
    $('keypad').replaceChildren(...digits.slice(0, 9), $('erase-btn'), digits[9], $('clear-btn'));
  }
  function render(history = false) {
    $('play-area').inert = paused;
    $('home-btn').disabled = paused; $('pause-btn').disabled = paused;
    slots.forEach((el, index) => {
      el.textContent = game.draft[index] || '·'; el.disabled = paused;
      el.classList.toggle('active', index === game.cursor);
      el.setAttribute('aria-pressed', String(index === game.cursor));
      el.setAttribute('aria-label', `${index + 1}번째 자리, ${game.draft[index] || '비어 있음'}`);
    });
    digits.forEach((el) => {
      const n = el.dataset.digit;
      el.disabled = paused || !config().pool.includes(n) || (game.cursor === 0 && n === '0')
        || game.draft.some((d, i) => i !== game.cursor && d === n);
    });
    $('submit-btn').disabled = paused || !G.validNumber(game.draft.join(''), config());
    $('erase-btn').disabled = paused || !game.draft.some(Boolean);
    $('clear-btn').disabled = paused || !game.draft.some(Boolean);
    $('undo-btn').disabled = paused || !game.draftHistory.length;
    $('hint-btn').disabled = paused || game.hintsUsed >= config().digits - 1;
    $('attempts').textContent = game.guesses.length;
    $('timer').textContent = M.formatTime(game.elapsed); $('game-label').textContent = label(game);
    $('input-label').textContent = `${config().digits}자리 숫자를 골라 주세요`;
    $('range-info').textContent = `${game.difficulty === 'easy' ? '1~6' : '0~9'} 사용 · 중복 없음 · 첫 자리 0 제외`;
    $('hint-info').textContent = game.hintsUsed
      ? `공개된 자리: ${[...game.answer].map((n, i) => i < game.hintsUsed ? n : '?').join(' ')} · 힌트 ${game.hintsUsed}회`
      : `자리 힌트는 최대 ${config().digits - 1}회 · 사용하면 결과에 표시돼요`;
    if (history) {
      renderHistory();
      $('candidate-info').hidden = !config().candidates;
      if (config().candidates) $('candidate-info').textContent = `기록과 힌트에 맞는 후보 ${G.remainingCandidates(game).length}개`;
    }
  }
  function renderHistory() {
    $('empty-history').hidden = game.guesses.length > 0;
    const rows = game.guesses.slice().reverse().map((g, i) => {
      const row = document.createElement('li'); row.className = 'attempt-row';
      const count = document.createElement('span'); count.className = 'attempt-no'; count.textContent = `${game.guesses.length - i}회`;
      const number = document.createElement('b'); number.className = 'attempt-number'; number.textContent = g.number;
      const result = document.createElement('span'); result.className = 'attempt-result';
      if (!g.strikes && !g.balls) { result.textContent = '아웃'; result.classList.toggle('out', true); }
      else {
        const strike = document.createElement('span'); strike.className = 'strike'; strike.textContent = `${g.strikes}S`;
        const ball = document.createElement('span'); ball.className = 'ball'; ball.textContent = `${g.balls}B`;
        result.append(strike, ball);
      }
      result.setAttribute('aria-label', `${g.strikes} 스트라이크 ${g.balls} 볼`);
      row.append(count, number, result); return row;
    });
    $('attempt-list').replaceChildren(...rows);
  }
  function startIfNeeded() { if (game.started && !timer && !paused) startTimer(); }
  function input(digit) {
    if (!game || paused || finished) return;
    const result = G.putDigit(game, digit);
    if (result === 'leading-zero') message('첫 자리에는 0을 사용할 수 없어요.');
    else if (result === 'duplicate') message('같은 숫자는 한 번만 사용할 수 있어요. 바꿀 자리를 먼저 누르세요.');
    else if (result === 'range') message('이 난이도에서 사용할 수 없는 숫자예요.');
    else if (result === 'ok') message(game.draft.every(Boolean) ? '숫자를 확인하고 결과 확인을 누르세요.' : '나머지 숫자를 골라 주세요.');
    startIfNeeded(); render(); save();
  }
  function edit(action) {
    if (!game || paused || finished) return;
    if (action(game)) { message('입력을 수정했어요. 제출한 기록은 그대로 남아요.'); render(); save(); }
  }
  function submit() {
    if (!game || paused || finished) return;
    const result = G.submit(game);
    if (result.status === 'incomplete') { message(`${config().digits}자리 숫자를 모두 골라 주세요.`); return; }
    if (result.status === 'repeated') { message(`${result.attempt}회에 이미 확인한 숫자예요. 다른 숫자로 추리해 보세요.`); return; }
    if (result.status === 'done') return;
    if (result.status === 'won') { finish(); return; }
    const text = result.strikes || result.balls ? `${result.strikes} 스트라이크, ${result.balls} 볼이에요.`
      : '아웃! 방금 입력한 숫자들은 정답에 없어요.';
    message(`${game.guesses.length}회 결과: ${text}`);
    MaeilFx.play(result.strikes ? 'match' : 'flip'); startIfNeeded(); render(true); save();
  }
  function hint() {
    if (!game || paused || finished) return;
    const h = G.reveal(game); if (!h) return;
    message(`${h.position + 1}번째 자리의 정답은 ${h.digit}이에요. 힌트 사용 ${game.hintsUsed}회로 기록됩니다.`);
    startIfNeeded(); render(true); save();
  }
  function tick() {
    if (!timer || !game) return;
    const now = performance.now(); game.elapsed += Math.max(0, now - lastTick) / 1000; lastTick = now;
  }
  function stopTimer() { tick(); clearInterval(timer); timer = 0; }
  function startTimer() {
    stopTimer(); lastTick = performance.now(); ticks = 0;
    timer = setInterval(() => { tick(); $('timer').textContent = M.formatTime(game.elapsed); if (++ticks % 20 === 0) save(); }, 250);
  }
  function pause() {
    if (!game || paused || finished || $('game-screen').hidden) return;
    stopTimer(); paused = true; $('pause-overlay').hidden = false; render(); save(); $('resume-btn').focus();
  }
  function resume() {
    if (!game || !paused || finished) return;
    paused = false; $('pause-overlay').hidden = true; render(); startIfNeeded(); slots[game.cursor].focus();
  }
  function finish() {
    if (finished) return;
    stopTimer(); finished = true; clearSave();
    const record = { attempts: game.guesses.length, hints: game.hintsUsed, seconds: Math.floor(game.elapsed) };
    const stats = loadStats(), key = game.daily ? 'daily' : game.difficulty;
    const old = stats[key], isBest = better(record, old?.best);
    stats[key] = { played: (Number.isSafeInteger(old?.played) && old.played >= 0 ? old.played : 0) + 1,
      best: isBest ? record : old.best };
    M.write(KEY.stats, stats);
    if (game.daily) {
      const previous = M.read(KEY.daily);
      if (!previous || typeof previous.date !== 'string' || previous.date < game.daily
        || (previous.date === game.daily && better(record, previous))) M.write(KEY.daily, { date: game.daily, ...record });
      M.recordDaily(ID, game.daily);
    }
    summary(); $('result-sub').textContent = label(game); $('result-answer').textContent = game.answer;
    $('result-attempts').textContent = `${record.attempts}회`;
    $('result-detail').textContent = `자리 힌트 ${record.hints}회 · ${M.formatTime(record.seconds)}`;
    $('result-best').textContent = `${isBest ? '새 최고 기록! ' : '내 최고 '}${recordText(stats[key].best)}`;
    $('result-best').classList.toggle('new', isBest);
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '새 게임';
    screen('result-screen'); MaeilFx.celebrate({ isBest, won: true }); $('share-btn').focus();
  }
  function share() { M.share({ title: '숫자야구 — 매일게임', text: G.shareText(game), url: M.pageUrl('number-baseball/') + (game.daily ? '#daily' : '') }); }
  function keydown(event) {
    if ($('game-screen').hidden || !game || finished || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) (paused ? resume() : pause()); return; }
    if (paused) return;
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); if (!event.repeat) input(event.key); }
    else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); if (!event.repeat) edit(G.erase); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); game.cursor = (game.cursor + (event.key === 'ArrowRight' ? 1 : config().digits - 1)) % config().digits;
      render(); save(); slots[game.cursor].focus();
    } else if (event.key === 'Enter' && (slots.includes(event.target) || digits.includes(event.target) || event.target === document.body)) {
      event.preventDefault(); if (!event.repeat) submit();
    }
  }
  M.bindSettingButtons();
  picker = MaeilStart.setup({ id: ID,
    difficulties: Object.entries(G.DIFFICULTIES).map(([key, c]) => ({ key, label: c.label, detail: c.detail })),
    bestText: (key) => recordOK(loadStats()[key]?.best) ? `내 최고 ${recordText(loadStats()[key].best)}` : '',
    onStart: (key) => start(G.create(key)), onDaily: startDaily,
  });
  $('continue-btn').addEventListener('click', () => { const s = loadGame(); if (s) start(s); else renderStart(); });
  $('home-btn').addEventListener('click', () => { stopTimer(); save(); renderStart(); });
  $('pause-btn').addEventListener('click', pause); $('resume-btn').addEventListener('click', resume);
  $('submit-btn').addEventListener('click', submit); $('hint-btn').addEventListener('click', hint);
  $('erase-btn').addEventListener('click', () => edit(G.erase)); $('clear-btn').addEventListener('click', () => edit(G.clear));
  $('undo-btn').addEventListener('click', () => edit(G.undoDraft));
  $('again-btn').addEventListener('click', () => game.daily ? startDaily() : start(G.create(game.difficulty)));
  $('result-home-btn').addEventListener('click', renderStart); $('share-btn').addEventListener('click', share);
  document.addEventListener('keydown', keydown);
  document.addEventListener('paste', (event) => {
    if (!game || paused || finished || $('game-screen').hidden) return;
    const text = event.clipboardData?.getData('text')?.trim();
    if (G.paste(game, text)) { event.preventDefault(); startIfNeeded(); message('붙여 넣은 숫자를 확인해 주세요.'); render(); save(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { if (!finished && !$('game-screen').hidden) pause(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted && !finished && !$('game-screen').hidden) pause(); });
  renderStart(); summary(); MaeilStart.handleDailyLink(startDaily); M.registerOffline('../');
})();
