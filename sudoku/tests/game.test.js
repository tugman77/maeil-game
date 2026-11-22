// 게임 규칙 자동 검사. 실행: node tests/game.test.js
const { generatePuzzle } = require('../js/generator.js');
const Game = require('../js/game.js');

let failed = false;
function check(name, ok) {
  console.log(`  ${ok ? '통과' : '실패'}  ${name}`);
  if (!ok) failed = true;
}

const game = Game.create(generatePuzzle('medium'));
const given = game.puzzle.findIndex((v) => v !== 0);
const empty = game.puzzle.findIndex((v) => v === 0);
const peer = Game.PEERS[empty].find((p) => game.puzzle[p] === 0);
const wrong = game.solution[empty] % 9 + 1;

console.log('[게임 규칙 검사]');
check('처음부터 있던 숫자는 바꿀 수 없음', !Game.setValue(game, given, 1) && !Game.erase(game, given));

Game.setValue(game, empty, wrong);
check('빈칸에 숫자 입력', game.values[empty] === wrong);
check('빈칸에 숫자가 있으면 메모 불가', !Game.toggleNote(game, empty, 3));

Game.erase(game, empty);
check('지우기', game.values[empty] === 0);

const otherNote = wrong % 9 + 1;
Game.toggleNote(game, peer, wrong);
Game.toggleNote(game, peer, otherNote);
check('메모 적기', Game.hasNote(game, peer, wrong) && Game.hasNote(game, peer, otherNote));

Game.setValue(game, empty, wrong);
check('숫자를 쓰면 같은 줄·구역 메모에서 자동 삭제',
  !Game.hasNote(game, peer, wrong) && Game.hasNote(game, peer, otherNote));

check('되돌리기는 동작이 일어난 칸을 알려줌', Game.undo(game) === empty);
check('되돌리기로 숫자와 지워진 메모가 함께 복구', game.values[empty] === 0 && Game.hasNote(game, peer, wrong));

Game.undo(game);
Game.undo(game);
Game.undo(game);
Game.undo(game);
check('모든 동작을 되돌리면 처음 상태', game.values.join('') === game.puzzle.join('') && game.notes.every((n) => n === 0));
check('더 되돌릴 것이 없으면 -1', Game.undo(game) === -1);

const givenPeer = Game.PEERS[empty].find((i) => game.puzzle[i] !== 0);
Game.setValue(game, empty, game.puzzle[givenPeer]);
const clash = Game.conflicts(game);
check('같은 줄·구역 중복 숫자 표시', clash.has(empty) && clash.has(givenPeer));
Game.erase(game, empty);
check('중복이 없으면 표시 없음', Game.conflicts(game).size === 0);

game.puzzle.forEach((v, i) => { if (v === 0) Game.setValue(game, i, game.solution[i]); });
check('정답으로 다 채우면 완성', Game.isFull(game) && Game.isSolved(game));
Game.setValue(game, empty, wrong);
check('틀린 숫자가 있으면 다 채워도 완성 아님', Game.isFull(game) && !Game.isSolved(game));
check('저장 가능한 형태 (JSON 변환 후에도 동일)',
  JSON.stringify(JSON.parse(JSON.stringify(game))) === JSON.stringify(game));

console.log('[힌트 검사]');
const h = Game.create(generatePuzzle('hard'));
const blanks = h.puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
const [first, second, third, fourth] = blanks;
check('처음 힌트는 3회', h.hintsLeft === 3);
check('고정된 숫자에는 힌트 불가', Game.useHint(h, h.puzzle.findIndex((v) => v !== 0)) === 'locked' && h.hintsLeft === 3);

Game.setValue(h, first, h.solution[first]);
check('이미 맞게 쓴 칸에는 힌트를 쓰지 않음', Game.useHint(h, first) === 'correct' && h.hintsLeft === 3);

Game.setValue(h, second, h.solution[second] % 9 + 1);
check('힌트로 정답 공개', Game.useHint(h, second) === 'ok' && h.values[second] === h.solution[second] && h.hintsLeft === 2);
check('힌트 칸은 고정되어 수정·지우기 불가',
  !Game.setValue(h, second, 1) && !Game.erase(h, second) && Game.isLocked(h, second));
Game.undo(h);
check('되돌리기로 힌트 칸이 바뀌지 않음', h.values[second] === h.solution[second]);

Game.useHint(h, third);
check('두 번째 힌트 후 1회 남음', h.hintsLeft === 1);
Game.useHint(h, fourth);
check('세 번째 힌트 후 0회', h.hintsLeft === 0);
check('네 번째 힌트는 거부', Game.useHint(h, blanks[4]) === 'none-left' && h.values[blanks[4]] === 0);

process.exitCode = failed ? 1 : 0;
