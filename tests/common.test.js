// 공통 모듈과 사이트 구성 자동 검사. 실행: node tests/common.test.js
const fs = require('fs');
const path = require('path');

const data = new Map();
global.localStorage = {
  getItem: (key) => (data.has(key) ? data.get(key) : null),
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key),
};

const M = require('../common/core.js');
const SudokuGenerator = require('../sudoku/js/generator.js');
const ROOT = path.join(__dirname, '..');

let failed = false;
function check(name, ok) {
  console.log(`  ${ok ? '통과' : '실패'}  ${name}`);
  if (!ok) failed = true;
}

console.log('[시드 난수]');
{
  const a = M.createSeededRandom('maeil-sudoku:2026-11-22');
  const b = SudokuGenerator.createSeededRandom('maeil-sudoku:2026-11-22');
  const same = Array.from({ length: 1000 }).every(() => a() === b());
  check('공통 시드 난수 = 스도쿠 생성기 시드 난수 (1000개)', same);
  const x = M.dailyRandom('2048', '2026-11-22');
  const y = M.dailyRandom('2048', '2026-11-22');
  const z = M.dailyRandom('2048', '2026-11-23');
  const first = [x(), x(), x()];
  check('같은 게임·같은 날짜는 같은 순서', JSON.stringify(first) === JSON.stringify([y(), y(), y()]));
  check('날짜가 다르면 다른 순서', first[0] !== z());
}

console.log('[스도쿠 오늘의 문제 보존]');
{
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/sudoku-daily.json'), 'utf8'));
  const dates = Object.keys(fixture);
  const changed = dates.filter((date) => SudokuGenerator.generateDailyPuzzle(date).puzzle.join('') !== fixture[date]);
  check(`옮기기 전 매일 스도쿠와 같은 문제 (${dates[0]}부터 ${dates.length}일치)`, changed.length === 0);
  if (changed.length) console.log('    달라진 날짜:', changed.slice(0, 5).join(', '));
}

console.log('[한국 날짜]');
{
  // 2026-11-22 15:30 UTC = 한국 11-23 00:30
  check('한국 자정이 지나면 다음 날', M.todayKey(Date.UTC(2026, 10, 22, 15, 30)) === '2026-11-23');
  check('한국 자정 전이면 그날', M.todayKey(Date.UTC(2026, 10, 22, 14, 59)) === '2026-11-22');
  check('연말 넘어감', M.todayKey(Date.UTC(2026, 11, 31, 15, 0)) === '2027-01-01');
  check('날짜 차이(월 넘김)', M.daysBetween('2026-11-30', '2026-12-01') === 1);
  check('날짜 글자', M.dateLabel('2026-11-08') === '11월 8일');
  check('시간 글자', M.formatTime(452) === '07:32' && M.formatTimeKorean(452) === '7분 32초');
}

console.log('[연속 출석]');
{
  data.clear();
  check('처음엔 0일', M.currentStreak('2026-11-22') === 0);
  M.recordDaily('sudoku', '2026-11-22');
  check('첫 도전 1일', M.currentStreak('2026-11-22') === 1);
  M.recordDaily('2048', '2026-11-22');
  check('같은 날 두 게임은 1일 그대로', M.currentStreak('2026-11-22') === 1);
  check('그날 한 게임 표시', M.dailyDone('sudoku', '2026-11-22') && M.dailyDone('2048', '2026-11-22'));
  M.recordDaily('sudoku', '2026-11-23');
  check('다음 날 2일', M.currentStreak('2026-11-23') === 2);
  check('하루 쉬어도 어제 기록은 유지(오늘 아직 안 함)', M.currentStreak('2026-11-24') === 2);
  check('이틀 쉬면 0일', M.currentStreak('2026-11-25') === 0);
  M.recordDaily('sudoku', '2026-11-26');
  check('끊긴 뒤 다시 1일, 최장 기록 2일 보존', M.currentStreak('2026-11-26') === 1 && M.loadDaily().best === 2);
  M.recordDaily('sudoku', '2026-11-20');
  check('기기 시계가 뒤로 가도 기록이 망가지지 않음', M.currentStreak('2026-11-26') === 1);
  M.recordDaily('sudoku', '2026-12-05');
  check('오래된 날짜 정리', !('2026-11-22' in M.loadDaily().done));
}

console.log('[매일 스도쿠 기록 이어받기]');
{
  data.clear();
  data.set('maeil-sudoku.settings.v1', JSON.stringify({ showErrors: false, dark: true, largeText: true }));
  data.set('maeil-sudoku.daily.v1', JSON.stringify({ date: '2026-11-21', seconds: 300 }));
  const settings = M.loadSettings();
  check('어두운 화면·큰 글씨 설정 이어받음', settings.dark === true && settings.largeText === true && settings.sound === true);
  check('어제 푼 오늘의 문제 → 연속 1일 유지', M.currentStreak('2026-11-22') === 1);
  M.recordDaily('sudoku', '2026-11-22');
  check('오늘 이어서 하면 2일', M.currentStreak('2026-11-22') === 2);
}

console.log('[요약·최근 게임]');
{
  data.clear();
  M.setSummary('sudoku', '최고 07:32 (보통)');
  M.markPlayed('sudoku');
  check('게임별 한 줄 기록', M.loadSummaries().sudoku === '최고 07:32 (보통)');
  check('최근 게임', M.recentGame() === 'sudoku');
}

console.log('[사이트 구성]');
{
  const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'games.json'), 'utf8'));
  const ids = games.map((game) => game.id);
  check('games.json: id 중복 없음', new Set(ids).size === ids.length);
  check('games.json: 필수 항목', games.every((g) => g.id && g.name && g.desc && g.icon && g.path && ['ready', 'soon'].includes(g.status)));
  const ready = games.filter((game) => game.status === 'ready');
  check('공개 게임은 폴더에 index.html이 있음', ready.every((g) => fs.existsSync(path.join(ROOT, g.path, 'index.html'))));

  // 오프라인 보관 목록(sw.js)에 사이트 파일이 모두 들어 있는지
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const needed = ['index.html', 'hub.css', 'hub.js', 'games.json', 'common/base.css', 'common/core.js', 'common/game.css', 'common/thumbs.js', 'common/thumbs.css', 'common/start.js', 'common/start.css'];
  ready.forEach((g) => {
    const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach((entry) => {
      const rel = `${dir}${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'tests') walk(`${rel}/`);
      } else if (/\.(html|css|js|json)$/.test(entry.name)) {
        needed.push(rel);
      }
    });
    walk(g.path);
  });
  ready.forEach((g) => needed.push(`guide/${g.id}.html`));
  needed.push('guide/index.html', 'guide/guide.css', 'about.html', 'privacy.html');
  check('공개 게임마다 설명 페이지가 있음', ready.every((g) => fs.existsSync(path.join(ROOT, 'guide', `${g.id}.html`))));
  const missing = needed.filter((file) => !listed.has(file));
  check('sw.js 보관 목록에 빠진 파일 없음', missing.length === 0);
  if (missing.length) console.log('    빠진 파일:', missing.join(', '));
}

if (failed) {
  console.log('\n실패한 검사가 있습니다.');
  process.exit(1);
}
console.log('\n모두 통과');
