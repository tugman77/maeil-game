(() => {
  const M = MaeilGame, G = KlondikeGame, ID = 'klondike';
  const KEY = { game: 'maeil-game.klondike.game.v1', stats: 'maeil-game.klondike.stats.v1', daily: 'maeil-game.klondike.daily.v1' };
  const $ = (id) => document.getElementById(id);
  let game = null, picker, selected = null, suggested = null, solution = new Map();
  let paused = false, finished = false, restartArmed = false, armTimer = 0;
  let timer = 0, lastTick = 0, ticks = 0, statusTimer = 0;
  let buttons = new Map(), columnSelectors = [], cardPicker;
  const pointKey = (p) => `${p.type}:${p.index}:${p.start ?? ''}`;
  const dealLabel = (s) => `KD-${s.dealNumber.toString(36).toUpperCase()}`;
  const label = (s) => s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : G.DIFFICULTIES[s.difficulty].label;
  function loadStats() { const s = M.read(KEY.stats); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; }
  function loadGame() { const s = M.read(KEY.game); return G.isValid(s) && !G.isDone(s) ? s : null; }
  const save = () => { if (game && !finished && !G.isDone(game)) M.write(KEY.game, game); };
  const clearSave = () => { try { localStorage.removeItem(KEY.game); } catch {} };
  const recordOK = (r) => r && Number.isSafeInteger(r.moves) && r.moves >= 52 && Number.isFinite(r.seconds) && r.seconds >= 0;
  const better = (a, b) => !recordOK(b) || a.moves < b.moves || (a.moves === b.moves && a.seconds < b.seconds);
  function summary() {
    const stats = loadStats(), keys = Object.keys(G.DIFFICULTIES).filter((k) => recordOK(stats[k]?.best))
      .sort((a,b) => (stats[b].played || 0) - (stats[a].played || 0));
    if (keys.length) M.setSummary(ID, `최고 ${stats[keys[0]].best.moves}수 (${G.DIFFICULTIES[keys[0]].label})`);
  }
  function screen(id) {
    ['start-screen', 'game-screen', 'result-screen'].forEach((key) => { $(key).hidden = key !== id; });
    window.scrollTo(0, 0);
  }
  const message = (text) => { clearTimeout(statusTimer); $('game-status').textContent = text; statusTimer=setTimeout(()=>{$('game-status').textContent='';},5000); };
  function disarm() { restartArmed = false; clearTimeout(armTimer); $('restart-btn').textContent = '처음 배치'; $('restart-btn').classList.toggle('armed', false); }
  function renderStart() {
    stopTimer(); disarm(); cardPicker?.close();
    const day = M.todayKey(), result = M.read(KEY.daily), done = M.dailyDone(ID, day);
    picker.setDaily(done && result?.date === day && recordOK(result)
      ? `${M.dateLabel(day)} · 완료 ${result.moves}수` : `${M.dateLabel(day)} · 모두 같은 풀이 검증 판`, done);
    const saved = loadGame(); $('continue-wrap').hidden = !saved;
    $('start-screen').classList.toggle('has-continue', Boolean(saved));
    if (saved) $('continue-info').textContent = `${label(saved)} · ${dealLabel(saved)} · ${G.foundationCount(saved)}/52장 정리`;
    picker.refresh(); screen('start-screen');
  }
  function start(state) {
    stopTimer(); disarm(); cardPicker?.close(); game = state; paused = false; finished = false; selected = null; suggested = null;
    solution = G.solutionMap(game); M.markPlayed(ID); save();
    $('pause-overlay').hidden = true; screen('game-screen');
    message(G.legalMoves(game).length ? '옮길 카드를 누른 다음 목적지를 누르세요.' : '지금 가능한 이동이 없어요. 되돌리거나 처음 배치에서 다시 도전하세요.'); render();
    if (game.started) startTimer();
  }
  function startDaily() {
    const day = M.todayKey(), saved = loadGame();
    start(saved?.daily === day ? saved : G.create(G.DAILY_DIFFICULTY, { daily: day, random: M.dailyRandom(ID, day) }));
  }
  function cardButton(card, location, isSelected = false) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'playing-card';
    el.classList.toggle('red-card', G.red(card)); el.classList.toggle('selected', isSelected); el.disabled = paused;
    const corner = document.createElement('span'); corner.className = 'card-corner'; corner.textContent = G.cardText(card);
    const mark = document.createElement('span'); mark.className = 'card-mark'; mark.textContent = G.SUITS[G.suit(card)]; mark.setAttribute('aria-hidden', 'true');
    el.append(corner, mark); el.setAttribute('aria-label', `${location.type === 'waste' ? '뽑은 카드' : location.type === 'foundation' ? '완성 칸' : `${location.index+1}번 줄 ${location.start+1}번째`}, ${G.cardName(card)}${isSelected ? ', 선택됨' : ''}`);
    el.setAttribute('aria-pressed', String(isSelected)); el.dataset.point = pointKey(location);
    el.addEventListener('click', () => choose(location)); buttons.set(pointKey(location), el);
    return el;
  }
  function emptyButton(text, location) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'empty-card'; el.textContent = text; el.disabled = paused;
    el.setAttribute('aria-label', `${location.type === 'waste' ? '뽑은 카드 없음' : '빈 줄'} ${location.index+1}`);
    el.addEventListener('click', () => choose(location)); buttons.set(pointKey(location), el); return el;
  }
  function destination(location) { return selected && G.canMove(game, selected, location); }
  function render() {
    buttons = new Map(); $('play-area').inert = paused;
    $('home-btn').disabled = paused; $('pause-btn').disabled = paused;
    $('draw-btn').textContent=game.stock.length?`뽑기\n${game.stock.length}장`:game.waste.length?'다시 돌리기':'빈 덱';
    $('draw-btn').disabled=paused||(!game.stock.length&&!game.waste.length);
    $('draw-btn').classList.toggle('hint-target',suggested?.type==='draw');
    const waste=game.waste.length?cardButton(game.waste.at(-1),{type:'waste',index:0},selected?.type==='waste'):emptyButton('뽑은 카드',{type:'waste',index:0});
    waste.classList.toggle('destination',false);$('waste-slot').replaceChildren(waste);
    const foundations = game.foundations.map((value, index) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'foundation'; el.disabled = paused;
      el.classList.toggle('red-card', index % 2 === 1); el.classList.toggle('destination', Boolean(destination({ type:'foundation', index })));
      el.textContent = value ? G.cardText(index * 13 + value - 1) : `${G.SUITS[index]} A`;
      el.classList.toggle('selected',selected?.type==='foundation'&&selected.index===index);el.setAttribute('aria-pressed',String(selected?.type==='foundation'&&selected.index===index));
      el.setAttribute('aria-label', `${G.SUIT_NAMES[index]} 완성 칸, ${value ? `${value}장 정리` : 'A부터 시작'}${destination({ type:'foundation', index }) ? ', 이동 가능' : ''}`);
      el.addEventListener('click', () => choose({ type: 'foundation', index }));
      buttons.set(`foundation:${index}:`, el); return el;
    });
    $('foundations').replaceChildren(...foundations);
    const columns = game.columns.map((column, index) => {
      const wrap = document.createElement('section'); wrap.className = 'tableau-column';
      const can = Boolean(destination({ type: 'column', index })); wrap.classList.toggle('destination-column', can);
      const label = document.createElement('button'); label.type='button'; label.className = 'column-label'; label.textContent = can ? '놓기' : `${index+1}줄`; label.disabled=paused;
      label.setAttribute('aria-label',`${index+1}번 줄${can?', 이동 가능':', 확대'}`);
      label.addEventListener('click',()=>openColumn(index));
      wrap.append(label);
      if (!column.length) wrap.append(emptyButton('빈 줄', {type:'column',index}));
      else column.forEach((card, start) => {
        const chosen = selected?.type === 'column' && selected.index === index && start >= selected.start;
        if(start<game.hidden[index]){const back=document.createElement('div');back.className='playing-card card-back';back.setAttribute('aria-label','뒷면 카드');wrap.append(back);}else wrap.append(cardButton(card, { type: 'column', index, start }, chosen));
      });
      if(can) {
        const target=wrap.children[wrap.children.length-1];
        target.classList.toggle('destination',true);
        target.setAttribute('aria-label',`${index+1}번 줄, 이동 가능`);
      }
      return wrap;
    });
    $('tableau').replaceChildren(...columns);
    columnSelectors = game.columns.map((column,index)=>{
      const b=document.createElement('button');b.type='button';b.className='column-button';b.disabled=paused;
      b.textContent=`${index+1}줄 확대`;b.setAttribute('aria-label',`${index+1}번 줄 확대${destination({type:'column',index})?', 이동 가능':''}`);
      b.classList.toggle('destination',Boolean(destination({type:'column',index})));b.setAttribute('aria-pressed',String(selected?.type==='column'&&selected.index===index));
      b.addEventListener('click',()=>openColumn(index));return b;
    });
    $('column-buttons').replaceChildren(...columnSelectors);
    $('selection-bar').hidden=false;
    MaeilCardTable.fit($('tableau'),7,Math.max(...game.columns.map(c=>c.length)));
    $('moves').textContent = game.moves; $('timer').textContent = M.formatTime(game.elapsed);
    $('game-label').textContent = label(game); $('deal-info').textContent = `판 번호 ${dealLabel(game)}`;
    $('foundation-count').textContent = `${G.foundationCount(game)}/52장 정리`;
    const cards = selected && G.sourceCards(game, selected);
    $('selection-info').textContent = cards ? `${G.cardText(cards[0])}${cards.length > 1 ? `부터 ${cards.length}장` : ''} 선택 · 목적지를 누르세요` : '옮길 카드를 바로 누르세요';
    $('cancel-btn').disabled = paused || !selected;
    $('undo-btn').disabled = paused || !game.history.length;
    $('hint-btn').disabled = paused || !G.legalMoves(game).length;
    $('auto-btn').disabled = paused || !G.safeMove(game);
    $('restart-btn').disabled = paused;
    $('help-counts').textContent = `추천 ${game.hintsUsed}회 · 되돌리기 ${game.undoUsed}회 · 시간 제한 없음`;
    if (suggested && suggested.type!=='draw') {
      buttons.get(pointKey(suggested.from))?.classList.toggle('hint-source', true);
      const target = buttons.get(pointKey(suggested.to))
        || (suggested.to.type === 'column' ? buttons.get(`column:${suggested.to.index}:${game.columns[suggested.to.index].length-1}`) : null);
      target?.classList.toggle('hint-target', true);
    }
  }
  function select(location) {
    const cards = G.sourceCards(game, location);
    if (!cards) { message('숫자가 하나씩 작아지고 빨강·검정이 번갈아 이어진 카드만 함께 옮길 수 있어요.'); return; }
    selected = { ...location }; suggested = null;
    const targets = ['column', 'foundation'].flatMap((type) => Array.from({ length: type === 'column' ? 7 : 4 }, (_, index) => ({ type, index })));
    const possible = targets.some((to) => G.canMove(game, selected, to));
    message(`${G.cardText(cards[0])}${cards.length > 1 ? `부터 ${cards.length}장` : ''}을 선택했어요. ${possible
      ? '테두리로 표시된 목적지로 옮길 수 있어요.' : '지금 옮길 곳이 없어요. 더 짧은 묶음을 고르거나 빈칸을 만드세요.'}`);
    render(); buttons.get(pointKey(location))?.focus({ preventScroll: true });
  }
  function openColumn(index) {
    if(paused||finished)return;
    if(selected && G.canMove(game,selected,{type:'column',index})) { choose({type:'column',index});return; }
    const cards=game.columns[index];
    if(!cards.length){message('먼저 옮길 카드를 선택하세요.');return;}
    cardPicker.open(`${index+1}번 줄 · ${cards.length}장`,cards.map((card,start)=>{
      const location={type:'column',index,start},run=G.sourceCards(game,location);
      return {location,label:start<game.hidden[index]?'뒷면':G.cardText(card),red:start>=game.hidden[index]&&G.red(card),enabled:Boolean(run),detail:start<game.hidden[index]?'아직 뒤집히지 않음':run?`${run.length}장 선택`:'선택 불가'};
    }));
  }
  function choose(location) {
    if (!game || paused || finished) return;
    disarm();
    if (selected) {
      if (pointKey(selected) === pointKey(location)) { cancel(); return; }
      const to = { type: location.type, index: location.index };
      if (G.move(game, selected, to)) {
        selected = null; suggested = null; startIfNeeded();
        MaeilFx.play('flip'); MaeilFx.buzz(10);
        if (G.isDone(game)) { finish(); return; }
        message(G.legalMoves(game).length ? '옮겼어요. 드러난 카드와 빈 줄을 활용해 보세요.' : '지금 가능한 이동이 없어요. 되돌리거나 처음 배치에서 다시 도전하세요.');
        render(); save(); return;
      }
      // 다른 카드나 같은 줄의 다른 묶음은 새로 선택할 수 있다.
      if (location.type === 'waste' && game.waste.length) { select(location); return; }
      if (location.type === 'column' && G.sourceCards(game, location)) { select(location); return; }
      message(location.type === 'foundation' ? '같은 무늬의 A부터 K까지 순서대로 한 장씩 정리하세요.'
        : location.type === 'waste' ? '뽑은 카드 중 맨 위 한 장만 옮길 수 있어요.'
          : '다른 색의 한 단계 큰 카드 아래에 놓으세요. 빈 줄에는 K로 시작하는 묶음만 놓을 수 있어요.');
      return;
    }
    if ((location.type === 'foundation' && !game.foundations[location.index]) || (location.type === 'waste' && !game.waste.length)
      || (location.type === 'column' && !game.columns[location.index].length)) {
      message('먼저 옮길 카드를 선택하세요.'); return;
    }
    select(location);
  }
  function cancel() { disarm(); selected = null; suggested = null; message('선택을 취소했어요.'); render(); }
  function undo() {
    if (!game || paused || finished || !G.undo(game)) return;
    disarm(); selected = null; suggested = null; message('직전 이동을 되돌렸어요. 자동 정리도 한 번에 되돌립니다.'); render(); save();
  }
  function hint() {
    if (!game || paused || finished) return;
    disarm(); const move = G.hint(game, solution); if (!move) { message('가능한 이동이 없어요. 되돌리기를 사용하세요.'); return; }
    game.hintsUsed++; game.started = true; suggested=move; startIfNeeded();
    if(move.type==='draw'){selected=null;message(game.stock.length?'덱에서 다음 카드를 한 장 뽑아 보세요.':'뽑은 카드를 덱으로 다시 돌려 보세요.');render();save();return;}
    selected = { ...move.from };
    const source = G.sourceCards(game, selected), to = move.to;
    const target = to.type === 'foundation' ? `${G.SUIT_NAMES[to.index]} 완성 칸` : `${to.index+1}번 줄`;
    message(`${G.cardText(source[0])}${source.length > 1 ? `부터 ${source.length}장` : ''}을 ${target}로 옮겨 보세요.`);
    render(); save();
  }
  function draw() {
    if(!game||paused||finished||!G.draw(game))return;
    disarm();selected=null;suggested=null;startIfNeeded();MaeilFx.play('flip');
    message(game.waste.length?'맨 위에 뽑힌 카드를 옮길 수 있어요.':'덱을 다시 돌렸어요. 순서는 그대로예요.');render();save();
  }
  function auto() {
    if (!game || paused || finished) return;
    disarm(); const count = G.autoFoundation(game);
    if (!count) { message('다른 카드 이동에 필요할 수 있어 아직 자동으로 정리하지 않아요. 직접 완성 칸으로 옮길 수도 있어요.'); return; }
    selected = null; suggested = null; startIfNeeded(); MaeilFx.play('match');
    if (G.isDone(game)) { finish(); return; }
    message(`안전하게 정리할 수 있는 ${count}장을 완성 칸으로 옮겼어요.`); render(); save();
  }
  function restart() {
    if (!game || paused || finished) return;
    if (!restartArmed) {
      restartArmed = true; $('restart-btn').textContent = '한 번 더 누르면 초기화'; $('restart-btn').classList.toggle('armed', true);
      armTimer = setTimeout(disarm, 4000); return;
    }
    start(G.create(game.difficulty, { daily: game.daily, dealNumber: game.dealNumber }));
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
  function startIfNeeded() { if (game.started && !timer && !paused) startTimer(); }
  function pause() {
    if (!game || paused || finished || $('game-screen').hidden) return;
    stopTimer(); disarm(); cardPicker.close(); paused = true; $('pause-overlay').hidden = false; render(); save(); $('resume-btn').focus();
  }
  function resume() {
    if (!game || !paused || finished) return;
    paused = false; $('pause-overlay').hidden = true; render(); startIfNeeded(); $('pause-btn').focus();
  }
  function finish() {
    if (finished) return;
    stopTimer(); disarm(); finished = true; clearSave();
    const record = { moves: game.moves, seconds: Math.floor(game.elapsed), hints: game.hintsUsed, undos: game.undoUsed };
    const stats = loadStats(), key = game.daily ? 'daily' : game.difficulty, previous = stats[key];
    const isBest = better(record, previous?.best);
    stats[key] = { played: (Number.isSafeInteger(previous?.played) && previous.played >= 0 ? previous.played : 0) + 1, best: isBest ? record : previous.best };
    M.write(KEY.stats, stats);
    if (game.daily) {
      const old = M.read(KEY.daily);
      if (!old || typeof old.date !== 'string' || old.date < game.daily || (old.date === game.daily && better(record, old))) M.write(KEY.daily, { date: game.daily, ...record });
      M.recordDaily(ID, game.daily);
    }
    summary(); $('result-sub').textContent = `${label(game)} · ${dealLabel(game)}`;
    $('result-moves').textContent = `${game.moves}수`;
    $('result-detail').textContent = `${M.formatTime(record.seconds)} · 추천 ${game.hintsUsed}회 · 되돌리기 ${game.undoUsed}회`;
    $('result-best').textContent = isBest ? '새 최고 기록이에요!' : `내 최고 ${stats[key].best.moves}수`;
    $('result-best').classList.toggle('new', isBest);
    $('again-btn').textContent = game.daily ? '오늘의 도전 다시' : '같은 판 다시';
    screen('result-screen'); MaeilFx.celebrate({ isBest, won: true }); $('share-btn').focus();
  }
  function share() {
    M.share({ title: '클론다이크 — 매일게임', text: `[매일게임 클론다이크] ${label(game)} · ${dealLabel(game)}\n52장 완료 · ${game.moves}수 · ${M.formatTimeKorean(game.elapsed)}\n추천 ${game.hintsUsed}회 · 되돌리기 ${game.undoUsed}회\n같이 한 판 즐겨요!`,
      url: M.pageUrl('klondike/') + (game.daily ? '#daily' : '') });
  }
  cardPicker = MaeilCardTable.createPicker({ onPick:select, onOpen:()=>{$('game-screen').inert=true;}, onClose:()=>{$('game-screen').inert=false;} });
  window.addEventListener('resize',()=>{if(game&&!finished)MaeilCardTable.fit($('tableau'),7,Math.max(...game.columns.map(c=>c.length)));});
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(game&&!finished)MaeilCardTable.fit($('tableau'),7,Math.max(...game.columns.map(c=>c.length)));}).observe($('tableau'));
  M.bindSettingButtons();
  picker = MaeilStart.setup({ id: ID,
    difficulties: Object.entries(G.DIFFICULTIES).map(([key,c]) => ({ key, label: c.label, detail: c.detail })),
    bestText: (key) => recordOK(loadStats()[key]?.best) ? `내 최고 ${loadStats()[key].best.moves}수` : '',
    onStart: (key) => start(G.create(key)), onDaily: startDaily,
  });
  $('continue-btn').addEventListener('click', () => { const s = loadGame(); if (s) start(s); else renderStart(); });
  $('home-btn').addEventListener('click', () => { stopTimer(); save(); renderStart(); });
  $('pause-btn').addEventListener('click', pause); $('resume-btn').addEventListener('click', resume);
  $('draw-btn').addEventListener('click',draw);
  $('cancel-btn').addEventListener('click', cancel); $('undo-btn').addEventListener('click', undo);
  $('hint-btn').addEventListener('click', hint); $('auto-btn').addEventListener('click', auto); $('restart-btn').addEventListener('click', restart);
  $('again-btn').addEventListener('click', () => game.daily ? startDaily() : start(G.create(game.difficulty, { dealNumber: game.dealNumber })));
  $('result-home-btn').addEventListener('click', renderStart); $('share-btn').addEventListener('click', share);
  document.addEventListener('keydown', (event) => {
    if ($('game-screen').hidden || finished || event.key !== 'Escape') return;
    event.preventDefault(); if (event.repeat) return;
    if (paused) resume(); else if (selected) cancel(); else pause();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { if (!finished && !$('game-screen').hidden) pause(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted && !finished && !$('game-screen').hidden) pause(); });
  renderStart(); summary(); MaeilStart.handleDailyLink(startDaily); M.registerOffline('../');
})();
