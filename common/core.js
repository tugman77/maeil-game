// 매일게임 공통 모듈: 모든 게임이 함께 쓰는 기능을 한 곳에 모은다.
// - 시드 난수(날짜별로 같은 판), 한국 날짜, 시간 글자
// - 저장소 읽기·쓰기, 설정(어두운 화면·큰 글씨·소리), 매일 도전·연속 출석, 게임 목록용 요약
// - 결과 공유(휴대폰 공유 창 / PC 복사), 안내 메시지
// 순수 JavaScript, 브라우저에서는 전역 MaeilGame, Node 검사에서는 require로 쓴다.
const MaeilGame = (() => {
  const PREFIX = 'maeil-game.';
  const KEYS = {
    settings: `${PREFIX}settings.v1`,
    daily: `${PREFIX}daily.v1`, // 매일 도전·연속 출석
    summary: `${PREFIX}summary.v1`, // 게임 목록에 보여 줄 게임별 한 줄 기록
    recent: `${PREFIX}recent.v1`, // 최근 한 게임
  };
  const SITE_URL = 'https://tugman77.github.io/maeil-game/';

  // ---------- 저장소 ----------
  // 비공개 창처럼 저장소를 쓸 수 없는 환경에서도 게임은 계속되도록 오류를 삼킨다.

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

  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  // ---------- 시드 난수 ----------
  // 글자(예: 'maeil-sudoku:2026-11-08')로 정해지는 난수. 같은 글자면 어느 기기에서나 같은 순서가 나온다.
  // ⚠️ 매일 스도쿠 generator.js의 createSeededRandom과 한 글자도 다르면 안 된다(오늘의 문제 보존).
  //    tests/common.test.js가 두 함수의 결과가 같은지 검사한다.
  function createSeededRandom(text) {
    let seed = 2166136261;
    for (let i = 0; i < text.length; i++) {
      seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
    }
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 게임별 오늘의 난수: dailyRandom('2048') → 'maeil-2048:2026-11-22'
  function dailyRandom(gameId, dateKey = todayKey()) {
    return createSeededRandom(`maeil-${gameId}:${dateKey}`);
  }

  // 저장했다 이어서 쓸 수 있는 난수: 상태가 숫자 하나라 게임 저장에 그대로 넣을 수 있다.
  // (2048·블록 쌓기처럼 판이 진행되며 계속 난수를 쓰는 게임용. 같은 글자·같은 조작이면 같은 결과)
  function randomState(text) {
    let seed = 2166136261;
    for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
    return seed | 0;
  }

  // holder.rng(숫자)를 한 단계 진행하고 0 이상 1 미만의 수를 돌려준다.
  function nextRandom(holder) {
    holder.rng = (holder.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(holder.rng ^ (holder.rng >>> 15), 1 | holder.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function shuffle(items, random = Math.random) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  // ---------- 날짜·시간 ----------
  // 매일 도전은 기기 시간이 아니라 한국 시간 자정 기준이다(해외에서도 같은 날 같은 판).

  const pad = (n) => String(n).padStart(2, '0');

  function todayKey(now = Date.now()) {
    const kst = new Date(now + 9 * 3600 * 1000);
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
  }

  function dayNumber(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  }

  function daysBetween(fromKey, toKey) {
    return dayNumber(toKey) - dayNumber(fromKey);
  }

  // '2026-11-08' → '11월 8일'
  function dateLabel(dateKey) {
    const [, month, day] = dateKey.split('-').map(Number);
    return `${month}월 ${day}일`;
  }

  // 125 → '02:05'
  function formatTime(totalSeconds) {
    const seconds = Math.floor(totalSeconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  // 공유 문구용: 452 → '7분 32초'
  function formatTimeKorean(totalSeconds) {
    const seconds = Math.floor(totalSeconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h && `${h}시간`, m && `${m}분`, (s || seconds === 0) && `${s}초`].filter(Boolean).join(' ');
  }

  // ---------- 설정 ----------
  // dark: true/false (정하지 않았으면 기기 설정을 따름), largeText, sound

  function loadSettings() {
    let saved = read(KEYS.settings);
    if (!isObject(saved)) {
      // 매일 스도쿠에서 쓰던 설정을 이어받는다.
      const old = read('maeil-sudoku.settings.v1');
      saved = {};
      if (isObject(old)) {
        if (typeof old.dark === 'boolean') saved.dark = old.dark;
        if (typeof old.largeText === 'boolean') saved.largeText = old.largeText;
      }
    }
    return { largeText: false, sound: true, ...saved };
  }

  function saveSettings(change) {
    const next = { ...loadSettings(), ...change };
    write(KEYS.settings, next);
    applySettings(next);
    return next;
  }

  function systemDark() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function isDark(settings = loadSettings()) {
    return typeof settings.dark === 'boolean' ? settings.dark : systemDark();
  }

  // 화면에 설정을 반영한다. 버튼에 class="dark-toggle" / "large-text-toggle" / "sound-toggle"을 붙이면 눌림 상태도 맞춘다.
  function applySettings(settings = loadSettings()) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const dark = isDark(settings);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.classList.toggle('large-text', Boolean(settings.largeText));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#15171c' : '#f4f1ea';
    const pressed = { '.dark-toggle': dark, '.large-text-toggle': settings.largeText, '.sound-toggle': settings.sound };
    Object.entries(pressed).forEach(([selector, on]) => {
      document.querySelectorAll(selector).forEach((button) => button.setAttribute('aria-pressed', String(Boolean(on))));
    });
  }

  // 설정 버튼에 동작을 붙인다(게임 목록·각 게임 공통).
  function bindSettingButtons(onChange) {
    const toggles = {
      '.dark-toggle': () => ({ dark: !isDark() }),
      '.large-text-toggle': () => ({ largeText: !loadSettings().largeText }),
      '.sound-toggle': () => ({ sound: !loadSettings().sound }),
    };
    Object.entries(toggles).forEach(([selector, change]) => {
      document.querySelectorAll(selector).forEach((button) => {
        button.addEventListener('click', () => {
          const next = saveSettings(change());
          if (onChange) onChange(next);
        });
      });
    });
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applySettings());
    }
    applySettings();
  }

  // ---------- 매일 도전·연속 출석 ----------
  // { last: 마지막으로 도전한 날, streak: 연속 일수, best: 최장 연속, done: { 날짜: [게임 id...] } }
  // 하루에 어느 게임이든 매일 도전을 하나 끝내면 그날은 출석으로 친다.

  function loadDaily() {
    const saved = read(KEYS.daily);
    if (isObject(saved) && typeof saved.last === 'string') return { done: {}, ...saved };
    // 매일 스도쿠의 마지막 오늘의 문제 기록이 있으면 출석 1일로 이어받는다.
    const old = read('maeil-sudoku.daily.v1');
    if (isObject(old) && typeof old.date === 'string') {
      return { last: old.date, streak: 1, best: 1, done: { [old.date]: ['sudoku'] } };
    }
    return { last: null, streak: 0, best: 0, done: {} };
  }

  function recordDaily(gameId, dateKey = todayKey()) {
    const daily = loadDaily();
    if (daily.last !== dateKey) {
      const gap = daily.last ? daysBetween(daily.last, dateKey) : Infinity;
      if (gap < 0) return daily; // 기기 시계가 뒤로 간 경우 무시
      daily.streak = gap === 1 ? daily.streak + 1 : 1;
      daily.last = dateKey;
    }
    daily.best = Math.max(daily.best || 0, daily.streak);
    const today = new Set(daily.done[dateKey] || []);
    today.add(gameId);
    // 최근 7일치만 남긴다.
    daily.done = Object.fromEntries(Object.entries({ ...daily.done, [dateKey]: [...today] })
      .filter(([key]) => daysBetween(key, dateKey) < 7));
    write(KEYS.daily, daily);
    return daily;
  }

  // 지금 이어지고 있는 연속 출석 일수(어제나 오늘 했으면 유지, 그보다 오래되면 0)
  function currentStreak(dateKey = todayKey()) {
    const daily = loadDaily();
    if (!daily.last) return 0;
    const gap = daysBetween(daily.last, dateKey);
    return gap === 0 || gap === 1 ? daily.streak : 0;
  }

  function dailyDone(gameId, dateKey = todayKey()) {
    return (loadDaily().done[dateKey] || []).includes(gameId);
  }

  // ---------- 게임 목록용 요약·최근 게임 ----------

  function setSummary(gameId, text) {
    const all = read(KEYS.summary) || {};
    all[gameId] = text;
    write(KEYS.summary, all);
  }

  function loadSummaries() {
    const all = read(KEYS.summary);
    return isObject(all) ? all : {};
  }

  function markPlayed(gameId) {
    write(KEYS.recent, { id: gameId, at: Date.now() });
  }

  function recentGame() {
    const recent = read(KEYS.recent);
    return isObject(recent) && typeof recent.id === 'string' ? recent.id : null;
  }

  // ---------- 결과 공유·안내 메시지 ----------

  // 버튼을 누른 즉시 끝나는 예전 복사 방식을 먼저 쓴다.
  // (새 방식은 브라우저에 따라 허락을 기다리며 멈춰 있을 수 있어, 예전 방식이 안 될 때만 쓴다.)
  async function copyText(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    area.remove();
    if (copied) return true;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  let toastTimer = 0;
  function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2500);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    const toast = document.getElementById('toast');
    if (toast) toast.hidden = true;
  }

  // 지금 보고 있는 게임의 주소(로컬 파일로 열었으면 배포 주소)
  function pageUrl(path = '') {
    return typeof location !== 'undefined' && location.protocol.startsWith('http')
      ? location.origin + location.pathname
      : SITE_URL + path;
  }

  // 휴대폰은 공유 창(카카오톡 등), 공유 창이 없는 PC는 문구+링크 복사
  async function share({ title, text, url }) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return; // 사용자가 공유 창을 닫음
      }
    }
    const copied = await copyText(`${text}\n${url}`);
    showToast(copied ? '복사했어요! 카카오톡 등에 붙여넣으세요' : '복사하지 못했어요. 주소를 직접 알려 주세요');
  }

  // ---------- 오프라인 동작 ----------
  // 사이트 맨 위의 sw.js 하나가 모든 게임 파일을 보관한다. rootPath: 이 페이지에서 사이트 맨 위까지('./' 또는 '../')
  function registerOffline(rootPath = './') {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (location.protocol === 'https:' || local) {
      navigator.serviceWorker.register(`${rootPath}sw.js`).catch(() => {});
    }
  }

  return {
    SITE_URL, read, write,
    createSeededRandom, dailyRandom, randomState, nextRandom, shuffle,
    todayKey, daysBetween, dateLabel, formatTime, formatTimeKorean,
    loadSettings, saveSettings, isDark, applySettings, bindSettingButtons,
    loadDaily, recordDaily, currentStreak, dailyDone,
    setSummary, loadSummaries, markPlayed, recentGame,
    copyText, showToast, hideToast, pageUrl, share, registerOffline,
  };
})();

if (typeof module !== 'undefined') module.exports = MaeilGame;
