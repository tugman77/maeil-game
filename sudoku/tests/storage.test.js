// 저장 기능 자동 검사. 실행: node tests/storage.test.js
// Node에는 브라우저 저장소가 없으므로 같은 동작을 하는 가짜 저장소를 만들어 검사한다.
const data = new Map();
global.localStorage = {
  getItem: (key) => (data.has(key) ? data.get(key) : null),
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key),
};

const { generatePuzzle } = require('../js/generator.js');
const Game = require('../js/game.js');
const SaveStore = require('../js/storage.js');

let failed = false;
function check(name, ok) {
  console.log(`  ${ok ? '통과' : '실패'}  ${name}`);
  if (!ok) failed = true;
}

console.log('[저장 검사]');
check('저장된 게임이 없으면 이어하기 없음', SaveStore.loadGame() === null);

const game = Game.create(generatePuzzle('medium'));
const empty = game.puzzle.indexOf(0);
Game.setValue(game, empty, 5);
Game.useHint(game, game.puzzle.indexOf(0, empty + 1));
game.elapsed = 123;
SaveStore.saveGame(game);
const loaded = SaveStore.loadGame();
check('저장한 게임을 그대로 불러옴', JSON.stringify(loaded) === JSON.stringify(game));
check('불러온 게임에서 되돌리기 동작', Game.undo(loaded) === empty && loaded.values[empty] === 0);

const dailyGame = Game.create(generatePuzzle('medium'), '2026-11-08');
SaveStore.saveGame(dailyGame);
check('오늘의 문제 날짜도 함께 저장', SaveStore.loadGame().daily === '2026-11-08');

SaveStore.clearGame();
check('완료 후 저장된 게임 삭제', SaveStore.loadGame() === null);

data.set('maeil-sudoku.game.v1', '{망가진 내용');
check('손상된 저장 내용은 무시', SaveStore.loadGame() === null);
data.set('maeil-sudoku.game.v1', JSON.stringify({ difficulty: 'easy', values: [1, 2] }));
check('형식이 틀린 저장 내용은 무시', SaveStore.loadGame() === null);

console.log('[기록·통계 검사]');
data.set('maeil-sudoku.best.v1', JSON.stringify({ medium: 26 }));
check('1차 출시 때의 최고 기록을 통계로 옮김',
  JSON.stringify(SaveStore.loadStats().medium) === JSON.stringify({ solved: 1, best: 26, total: 26 }));

let result = SaveStore.recordResult('easy', 300);
check('첫 기록은 최고 기록', result.isBest && result.best === 300 && result.previous === undefined);
check('기록을 남기면 옛 최고 기록도 통계에 함께 보관',
  SaveStore.loadStats().medium?.best === 26 && !data.has('maeil-sudoku.best.v1'));
result = SaveStore.recordResult('easy', 400);
check('더 느린 기록은 최고 기록 아님', !result.isBest && result.best === 300);
result = SaveStore.recordResult('easy', 250);
check('더 빠른 기록은 새 최고 기록', result.isBest && result.best === 250 && result.previous === 300);
const easy = SaveStore.loadStats().easy;
check('푼 횟수·시간 합계 누적 (3판, 950초)', easy.solved === 3 && easy.total === 950);
check('난이도별로 따로 저장', SaveStore.loadStats().hard === undefined);

console.log('[오늘의 문제 검사]');
check('안 푼 날은 기록 없음', SaveStore.loadDailyResult('2026-11-08') === null);
SaveStore.saveDailyResult('2026-11-08', 500);
SaveStore.saveDailyResult('2026-11-08', 600);
check('같은 날 다시 풀면 더 빠른 기록 유지', SaveStore.loadDailyResult('2026-11-08') === 500);
check('다음 날에는 다시 안 푼 상태', SaveStore.loadDailyResult('2026-11-09') === null);

console.log('[설정 검사]');
const defaults = SaveStore.loadSettings();
check('기본값: 오류 표시 켬, 큰 글씨 끔, 어두운 화면은 기기 설정 따름',
  defaults.showErrors === true && defaults.largeText === false && defaults.dark === undefined);
SaveStore.saveSettings({ showErrors: false, largeText: true, dark: true });
const changed = SaveStore.loadSettings();
check('설정 저장', changed.showErrors === false && changed.largeText === true && changed.dark === true);

console.log('[저장소를 쓸 수 없는 환경]');
global.localStorage = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
};
let crashed = false;
try {
  SaveStore.saveGame(game);
  SaveStore.loadGame();
  SaveStore.clearGame();
  SaveStore.recordResult('easy', 10);
  SaveStore.saveDailyResult('2026-11-08', 10);
  SaveStore.loadDailyResult('2026-11-08');
  SaveStore.loadSettings();
} catch {
  crashed = true;
}
check('저장이 막혀도 오류 없이 계속', !crashed);

process.exitCode = failed ? 1 : 0;
