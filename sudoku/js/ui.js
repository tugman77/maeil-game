// 화면 그리기와 버튼·키보드 처리.
// 게임 규칙은 game.js, 문제 생성은 generator.js, 저장은 storage.js가 맡는다.
const $ = (id) => document.getElementById(id);
const { DIFFICULTIES } = SudokuGenerator;
const SITE_URL = `${MaeilGame.SITE_URL}sudoku/`;
const STAT_ROWS = [
  ['easy', '쉬움'], ['medium', '보통'], ['hard', '어려움'], ['expert', '매우 어려움'], ['daily', '오늘의 문제'],
];

let game = null;
let selected = -1;
let memoMode = false;
let paused = false;
let finished = false;
let settings = SaveStore.loadSettings();
let timerId = 0;
let toastTimer = 0;

const cells = [];
const numButtons = [];
const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

// ---------- 시간·날짜 글자 ----------

function formatTime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// 공유 문구용: "7분 32초"
function formatTimeKorean(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h && `${h}시간`, m && `${m}분`, (s || seconds === 0) && `${s}초`].filter(Boolean).join(' ');
}

// 오늘 날짜 '2026-11-08' — 매일게임 공통 규칙대로 한국 시간 자정 기준
function todayKey() {
  return MaeilGame.todayKey();
}

// '2026-11-08' → '11월 8일'
function dateLabel(dateKey) {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${month}월 ${day}일`;
}

function gameLabel(state) {
  return state.daily ? '오늘의 문제' : DIFFICULTIES[state.difficulty].label;
}

function loadSavedGame() {
  const saved = SaveStore.loadGame();
  return saved && DIFFICULTIES[saved.difficulty] ? saved : null;
}

// ---------- 설정 (어두운 화면·큰 글씨) ----------

function isDark() {
  return typeof settings.dark === 'boolean' ? settings.dark : Boolean(systemDark?.matches);
}

function applySettings() {
  const root = document.documentElement;
  const dark = isDark();
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('large-text', settings.largeText);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#15171c' : '#f4f1ea';
  document.querySelectorAll('.dark-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(dark));
  });
  document.querySelectorAll('.large-text-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(settings.largeText));
  });
}

function updateSettings(change) {
  settings = { ...settings, ...change };
  SaveStore.saveSettings(settings);
  applySettings();
  render();
}

// ---------- 화면 만들기 ----------

function buildBoard() {
  const board = $('board');
  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (col % 3 === 2) cell.classList.add(col === 8 ? 'last-col' : 'col-end');
    if (row % 3 === 2) cell.classList.add(row === 8 ? 'last-row' : 'row-end');
    cell.setAttribute('role', 'gridcell');
    cell.addEventListener('click', () => selectCell(i));
    board.appendChild(cell);
    cells.push(cell);
  }
}

function buildNumpad() {
  const numpad = $('numpad');
  for (let digit = 1; digit <= 9; digit++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'num-btn';
    button.textContent = digit;
    button.addEventListener('click', () => inputDigit(digit));
    numpad.appendChild(button);
    numButtons.push(button);
  }
}

function showScreen(id) {
  ['start-screen', 'game-screen', 'complete-screen', 'stats-screen'].forEach((screen) => {
    $(screen).hidden = screen !== id;
  });
  window.scrollTo(0, 0);
}

// ---------- 게임 목록에 보여 줄 한 줄 기록 ----------
// 오늘의 문제를 풀었으면 그 시간, 아니면 가장 많이 푼 난이도의 최고 기록

function updateSummary() {
  const today = todayKey();
  const dailySeconds = SaveStore.loadDailyResult(today);
  if (dailySeconds !== null) {
    MaeilGame.setSummary('sudoku', `오늘의 문제 ✓ ${formatTime(dailySeconds)}`);
    return;
  }
  const stats = SaveStore.loadStats();
  const played = STAT_ROWS.filter(([key]) => key !== 'daily' && Number.isFinite(stats[key]?.best))
    .sort((a, b) => stats[b[0]].solved - stats[a[0]].solved);
  if (played.length) {
    const [key, label] = played[0];
    MaeilGame.setSummary('sudoku', `최고 ${formatTime(stats[key].best)} (${label})`);
  }
}

// ---------- 시작 화면 ----------

function renderStart() {
  const today = todayKey();
  const dailySeconds = SaveStore.loadDailyResult(today);
  const dailyInfo = $('daily-info');
  dailyInfo.classList.toggle('done', dailySeconds !== null);
  dailyInfo.textContent = dailySeconds !== null
    ? `${dateLabel(today)} · 완료 ✓ ${formatTime(dailySeconds)}`
    : `${dateLabel(today)} · 모두 같은 문제 (보통)`;

  const saved = loadSavedGame();
  $('continue-wrap').hidden = !saved;
  if (saved) $('continue-info').textContent = `${gameLabel(saved)} · ${formatTime(saved.elapsed)}`;

  const stats = SaveStore.loadStats();
  document.querySelectorAll('.difficulty-btn').forEach((button) => {
    const best = stats[button.dataset.difficulty]?.best;
    button.querySelector('.best').textContent = Number.isFinite(best) ? `최고 ${formatTime(best)}` : '';
  });
}

function goHome() {
  if (game && !finished) SaveStore.saveGame(game);
  stopTimer();
  game = null;
  hideToast();
  renderStart();
  showScreen('start-screen');
}

// ---------- 기록 화면 ----------

function showStats() {
  const stats = SaveStore.loadStats();
  let totalSolved = 0;
  const rows = STAT_ROWS.map(([key, label]) => {
    const entry = stats[key];
    const solved = entry?.solved || 0;
    totalSolved += solved;
    const best = Number.isFinite(entry?.best) ? formatTime(entry.best) : '-';
    const average = solved > 0 && Number.isFinite(entry.total) ? formatTime(Math.round(entry.total / solved)) : '-';
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    tr.appendChild(th);
    [`${solved}판`, best, average].forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });
    return tr;
  });
  $('stats-body').replaceChildren(...rows);
  $('stats-total').textContent = totalSolved > 0
    ? `지금까지 ${totalSolved}판을 완성했어요 👏`
    : '아직 완성한 게임이 없어요';
  showScreen('stats-screen');
}

// ---------- 게임 시작·이어하기 ----------

function startGame(difficulty) {
  enterGame(Game.create(SudokuGenerator.generatePuzzle(difficulty)));
  SaveStore.saveGame(game);
}

// 오늘의 문제: 하던 오늘의 문제가 있으면 이어서, 없으면 새로 시작한다.
function startDaily() {
  const today = todayKey();
  const saved = loadSavedGame();
  if (saved && saved.daily === today) {
    enterGame(saved);
    return;
  }
  enterGame(Game.create(SudokuGenerator.generateDailyPuzzle(today), today));
  SaveStore.saveGame(game);
}

function resumeGame() {
  const saved = loadSavedGame();
  if (saved) enterGame(saved);
  else renderStart();
}

function enterGame(state) {
  game = state;
  MaeilGame.markPlayed('sudoku');
  selected = -1;
  memoMode = false;
  paused = false;
  finished = false;
  $('difficulty-label').textContent = gameLabel(game);
  $('pause-overlay').hidden = true;
  hideToast();
  showScreen('game-screen');
  startTimer();
  render();
}

// ---------- 타이머·일시정지 ----------

function startTimer() {
  stopTimer();
  timerId = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = 0;
}

function tick() {
  if (!game || paused || finished || document.hidden) return;
  game.elapsed++;
  $('timer').textContent = formatTime(game.elapsed);
  SaveStore.saveGame(game);
}

function pauseGame() {
  if (!game || finished || paused) return;
  paused = true;
  hideToast();
  SaveStore.saveGame(game);
  $('pause-overlay').hidden = false;
  $('resume-btn').focus();
  render();
}

function resumeFromPause() {
  if (!paused) return;
  paused = false;
  $('pause-overlay').hidden = true;
  render();
}

// 다른 앱으로 넘어가거나 창을 닫으면 자동으로 일시정지하고 저장한다.
function handleVisibility() {
  if (document.hidden && game && !finished && !$('game-screen').hidden) pauseGame();
  // 자정을 넘겨 다시 열었을 때 오늘의 문제 날짜를 새로 표시한다.
  if (!document.hidden && !$('start-screen').hidden) renderStart();
}

function saveBeforeLeaving() {
  if (game && !finished) SaveStore.saveGame(game);
}

// ---------- 입력 ----------

function canPlay() {
  return game && !finished && !paused;
}

function selectCell(i) {
  if (!canPlay()) return;
  selected = i;
  render();
}

function moveSelection(dRow, dCol) {
  if (selected < 0) {
    selectCell(0);
    return;
  }
  const row = (Math.floor(selected / 9) + dRow + 9) % 9;
  const col = (selected % 9 + dCol + 9) % 9;
  selectCell(row * 9 + col);
}

function afterChange() {
  SaveStore.saveGame(game);
  render();
}

function inputDigit(digit) {
  if (!canPlay()) return;
  if (selected < 0) {
    showToast('먼저 칸을 눌러 주세요');
    return;
  }
  if (Game.isLocked(game, selected)) {
    showToast('고정된 숫자는 바꿀 수 없어요');
    return;
  }
  if (memoMode && game.values[selected] !== 0) {
    showToast('메모는 빈칸에만 적을 수 있어요');
    return;
  }
  const changed = memoMode
    ? Game.toggleNote(game, selected, digit)
    : Game.setValue(game, selected, digit);
  if (!changed) return;
  afterChange();
  if (!memoMode) checkFinished();
}

function eraseSelected() {
  if (!canPlay() || selected < 0) return;
  if (Game.erase(game, selected)) afterChange();
}

function undoLast() {
  if (!canPlay()) return;
  const cell = Game.undo(game);
  if (cell < 0) {
    showToast('되돌릴 동작이 없어요');
    return;
  }
  selected = cell;
  afterChange();
}

function useHint() {
  if (!canPlay()) return;
  if (game.hintsLeft <= 0) {
    showToast('힌트를 모두 사용했어요');
    return;
  }
  if (selected < 0) {
    showToast('힌트를 볼 칸을 먼저 눌러 주세요');
    return;
  }
  const result = Game.useHint(game, selected);
  const messages = {
    locked: '이미 고정된 숫자예요',
    correct: '이 칸은 이미 맞게 쓰셨어요',
    'none-left': '힌트를 모두 사용했어요',
  };
  if (result !== 'ok') {
    showToast(messages[result]);
    return;
  }
  afterChange();
  checkFinished();
}

function toggleMemo() {
  if (!canPlay()) return;
  memoMode = !memoMode;
  render();
}

// ---------- 완성 ----------

function checkFinished() {
  if (!Game.isFull(game)) return;
  if (!Game.isSolved(game)) {
    showToast('틀린 숫자가 있어요. 다시 살펴보세요');
    return;
  }
  finished = true;
  stopTimer();
  SaveStore.clearGame();
  const result = SaveStore.recordResult(game.daily ? 'daily' : game.difficulty, game.elapsed);
  if (game.daily) {
    SaveStore.saveDailyResult(game.daily, game.elapsed);
    MaeilGame.recordDaily('sudoku', game.daily);
  }
  updateSummary();
  showComplete(result);
}

function showComplete({ isBest, best, previous }) {
  $('complete-difficulty').textContent = game.daily
    ? `📅 ${dateLabel(game.daily)} 오늘의 문제`
    : `${DIFFICULTIES[game.difficulty].label} 난이도`;
  $('complete-time').textContent = formatTime(game.elapsed);
  const bestText = $('complete-best');
  bestText.classList.toggle('new', isBest);
  if (isBest && Number.isFinite(previous)) {
    bestText.textContent = `🏆 새 최고 기록! (이전 ${formatTime(previous)})`;
  } else if (isBest) {
    bestText.textContent = '🏆 첫 기록이 저장됐어요!';
  } else {
    bestText.textContent = `최고 기록 ${formatTime(best)}`;
  }
  $('new-game-btn').dataset.difficulty = game.difficulty;
  hideToast();
  showScreen('complete-screen');
  $('share-btn').focus();
}

// ---------- 결과 공유 ----------

function shareText() {
  const what = game.daily
    ? `${dateLabel(game.daily)} 오늘의 문제를`
    : `${DIFFICULTIES[game.difficulty].label} 난이도를`;
  return `[매일 스도쿠] ${what} ${formatTimeKorean(game.elapsed)}에 풀었어요! 🎉\n같이 풀어봐요 👉`;
}

function shareUrl() {
  return location.protocol.startsWith('http') ? location.origin + location.pathname : SITE_URL;
}

// 휴대폰은 공유 창(카카오톡 등), 공유 창이 없는 PC는 문구+링크 복사
async function shareResult() {
  if (!game) return;
  const text = shareText();
  const url = shareUrl();
  await MaeilGame.share({ title: '매일 스도쿠', text, url });
}

// ---------- 안내 메시지 ----------

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 2500);
}

function hideToast() {
  clearTimeout(toastTimer);
  $('toast').hidden = true;
}

// ---------- 게임 화면 그리기 ----------

function render() {
  if (!game) return;
  const conflictCells = settings.showErrors ? Game.conflicts(game) : new Set();
  const selectedDigit = selected >= 0 ? game.values[selected] : 0;
  const peers = new Set(selected >= 0 ? Game.PEERS[selected] : []);

  cells.forEach((cell, i) => {
    const value = game.values[i];
    const locked = Game.isLocked(game, i);
    cell.classList.toggle('given', locked);
    cell.classList.toggle('user', !locked && value !== 0);
    cell.classList.toggle('selected', i === selected);
    cell.classList.toggle('peer', peers.has(i));
    cell.classList.toggle('same', selectedDigit !== 0 && value === selectedDigit && i !== selected);
    cell.classList.toggle('conflict', conflictCells.has(i));

    const position = `${Math.floor(i / 9) + 1}행 ${(i % 9) + 1}열`;
    if (value) {
      cell.textContent = value;
      cell.setAttribute('aria-label', `${position}, ${value}${locked ? ', 고정' : ''}`);
    } else if (game.notes[i]) {
      const notes = document.createElement('span');
      notes.className = 'notes';
      const written = [];
      for (let digit = 1; digit <= 9; digit++) {
        const span = document.createElement('span');
        if (Game.hasNote(game, i, digit)) {
          span.textContent = digit;
          written.push(digit);
        }
        notes.appendChild(span);
      }
      cell.replaceChildren(notes);
      cell.setAttribute('aria-label', `${position}, 빈칸, 메모 ${written.join(' ')}`);
    } else {
      cell.textContent = '';
      cell.setAttribute('aria-label', `${position}, 빈칸`);
    }
  });

  numButtons.forEach((button, index) => {
    button.classList.toggle('used-up', Game.countDigit(game, index + 1) >= 9);
  });

  $('timer').textContent = formatTime(game.elapsed);
  $('memo-btn').setAttribute('aria-pressed', String(memoMode));
  $('memo-label').textContent = memoMode ? '메모 켬' : '메모 끔';
  $('hint-label').textContent = `힌트 ${game.hintsLeft}`;
  $('hint-btn').disabled = game.hintsLeft <= 0;
  $('error-toggle').setAttribute('aria-pressed', String(settings.showErrors));
  $('error-toggle').textContent = settings.showErrors ? '오류표시 켬' : '오류표시 끔';
}

// ---------- 키보드 ----------

function handleKey(event) {
  if (!game || finished || $('game-screen').hidden) return;
  if (paused) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      event.preventDefault();
      resumeFromPause();
    }
    return;
  }
  if (event.altKey || event.metaKey || event.ctrlKey) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undoLast();
    }
    return;
  }

  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (moves[event.key]) {
    event.preventDefault();
    moveSelection(...moves[event.key]);
  } else if (/^[1-9]$/.test(event.key)) {
    inputDigit(Number(event.key));
  } else if (['Backspace', 'Delete', '0'].includes(event.key)) {
    event.preventDefault();
    eraseSelected();
  } else if (event.key.toLowerCase() === 'n' || event.key === 'ㅜ') {
    toggleMemo();
  } else if (event.key === 'Escape') {
    pauseGame();
  }
}

// ---------- 오프라인 동작 ----------
// 한 번 열어 둔 뒤에는 인터넷이 끊겨도 게임이 열리도록 파일을 기기에 보관한다 (sw.js).
function registerOffline() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
    navigator.serviceWorker.register('../sw.js').catch(() => {}); // 사이트 전체 공용 sw.js
  }
}

// ---------- 시작 ----------

function init() {
  applySettings();
  buildBoard();
  buildNumpad();
  document.querySelectorAll('.difficulty-btn').forEach((button) => {
    button.addEventListener('click', () => startGame(button.dataset.difficulty));
  });
  document.querySelectorAll('.dark-toggle').forEach((button) => {
    button.addEventListener('click', () => updateSettings({ dark: !isDark() }));
  });
  document.querySelectorAll('.large-text-toggle').forEach((button) => {
    button.addEventListener('click', () => updateSettings({ largeText: !settings.largeText }));
  });
  systemDark?.addEventListener?.('change', applySettings);
  $('daily-btn').addEventListener('click', startDaily);
  $('continue-btn').addEventListener('click', resumeGame);
  $('stats-btn').addEventListener('click', showStats);
  $('stats-home-btn').addEventListener('click', goHome);
  $('home-btn').addEventListener('click', goHome);
  $('pause-btn').addEventListener('click', pauseGame);
  $('resume-btn').addEventListener('click', resumeFromPause);
  $('error-toggle').addEventListener('click', () => updateSettings({ showErrors: !settings.showErrors }));
  $('undo-btn').addEventListener('click', undoLast);
  $('erase-btn').addEventListener('click', eraseSelected);
  $('memo-btn').addEventListener('click', toggleMemo);
  $('hint-btn').addEventListener('click', useHint);
  $('share-btn').addEventListener('click', shareResult);
  $('new-game-btn').addEventListener('click', (event) => startGame(event.currentTarget.dataset.difficulty));
  $('complete-home-btn').addEventListener('click', goHome);
  document.addEventListener('keydown', handleKey);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', saveBeforeLeaving);
  renderStart();
  updateSummary();
  registerOffline();
}

init();
