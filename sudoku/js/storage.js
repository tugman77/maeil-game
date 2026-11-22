// 브라우저 저장소(localStorage)에 진행 중인 게임, 기록·통계, 오늘의 문제 완료 여부, 설정을 저장한다.
// 비공개 창처럼 저장소를 쓸 수 없는 환경에서도 게임은 계속되도록 오류를 삼킨다.
// (브라우저 기본 기능 이름 Storage와 겹치지 않도록 SaveStore라는 이름을 쓴다.)
const SaveStore = (() => {
  // 어두운 화면·큰 글씨·소리는 매일게임 공통 설정(common/core.js)을 쓴다.
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const KEYS = {
    game: 'maeil-sudoku.game.v1',
    stats: 'maeil-sudoku.stats.v1',
    oldBest: 'maeil-sudoku.best.v1', // 1차 출시 때의 최고 기록 (통계로 옮겨 씀)
    daily: 'maeil-sudoku.daily.v1',
    settings: 'maeil-sudoku.settings.v1',
  };

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // 저장소를 쓸 수 없으면 지울 것도 없다.
    }
  }

  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const is81 = (value) => Array.isArray(value) && value.length === 81;

  // ---------- 진행 중인 게임 ----------

  // 저장된 내용이 손상되었으면 이어하기를 보여주지 않는다.
  function isValidGame(game) {
    return isObject(game)
      && typeof game.difficulty === 'string'
      && ['puzzle', 'solution', 'values', 'notes', 'hinted'].every((key) => is81(game[key]))
      && Array.isArray(game.history)
      && Number.isInteger(game.hintsLeft)
      && Number.isFinite(game.elapsed);
  }

  function saveGame(game) {
    return write(KEYS.game, game);
  }

  function loadGame() {
    const game = read(KEYS.game);
    return isValidGame(game) ? game : null;
  }

  function clearGame() {
    remove(KEYS.game);
  }

  // ---------- 기록·통계 ----------
  // { easy: { solved: 푼 횟수, best: 최고 기록(초), total: 걸린 시간 합계(초) }, ..., daily: {...} }

  function loadStats() {
    const stats = read(KEYS.stats);
    if (isObject(stats)) return stats;
    // 1차 출시 때 저장한 최고 기록이 있으면 통계로 옮긴다 (푼 횟수는 1회로 친다).
    const oldBest = read(KEYS.oldBest);
    const migrated = {};
    if (isObject(oldBest)) {
      Object.entries(oldBest).forEach(([key, seconds]) => {
        if (Number.isFinite(seconds)) migrated[key] = { solved: 1, best: seconds, total: seconds };
      });
    }
    return migrated;
  }

  // 완료 기록을 반영하고 결과를 돌려준다: { isBest, best(초), previous(초 또는 undefined) }
  function recordResult(key, seconds) {
    const stats = loadStats();
    const entry = stats[key] || { solved: 0, total: 0 };
    const previous = entry.best;
    const isBest = !Number.isFinite(previous) || seconds < previous;
    stats[key] = {
      solved: entry.solved + 1,
      best: isBest ? seconds : previous,
      total: entry.total + seconds,
    };
    write(KEYS.stats, stats);
    remove(KEYS.oldBest);
    return { isBest, best: stats[key].best, previous };
  }

  // ---------- 오늘의 문제 ----------
  // 마지막으로 푼 날짜와 그날의 가장 빠른 기록만 남긴다: { date, seconds }

  function loadDailyResult(dateKey) {
    const daily = read(KEYS.daily);
    return isObject(daily) && daily.date === dateKey && Number.isFinite(daily.seconds)
      ? daily.seconds
      : null;
  }

  function saveDailyResult(dateKey, seconds) {
    const previous = loadDailyResult(dateKey);
    if (previous === null || seconds < previous) write(KEYS.daily, { date: dateKey, seconds });
  }

  // ---------- 설정 ----------
  // 스도쿠 전용: showErrors(오류 표시). 어두운 화면(dark)·큰 글씨(largeText)는 공통 설정에서 읽고 쓴다.

  function loadSettings() {
    const saved = read(KEYS.settings);
    const showErrors = isObject(saved) && typeof saved.showErrors === 'boolean' ? saved.showErrors : true;
    return { ...Common.loadSettings(), showErrors };
  }

  function saveSettings(settings) {
    const { showErrors, ...common } = settings;
    write(KEYS.settings, { showErrors });
    Common.saveSettings(common);
  }

  return {
    saveGame, loadGame, clearGame, loadStats, recordResult,
    loadDailyResult, saveDailyResult, loadSettings, saveSettings,
  };
})();

if (typeof module !== 'undefined') module.exports = SaveStore;
