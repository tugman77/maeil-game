// 카드 짝맞추기 규칙: 카드 두 장을 뒤집어 같은 그림이면 짝, 다르면 다시 덮는다.
const MemoryGame = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');

  // 큰 글씨로도 서로 헷갈리지 않는 그림만 고른다(색·모양이 뚜렷하게 다름).
  const SYMBOLS = ['🍎', '🍌', '🍇', '🍓', '🍉', '🍍', '🥕', '🌽', '🐶', '🐱', '🐰', '🐼', '🐸', '🐧', '🌻', '🌙', '⭐', '🚗', '🎈', '⚽'];
  const DIFFICULTIES = {
    easy: { label: '쉬움', pairs: 6, cols: 3 },
    medium: { label: '보통', pairs: 8, cols: 4 },
    hard: { label: '어려움', pairs: 10, cols: 4 },
  };
  const DAILY_DIFFICULTY = 'medium';

  // random을 넘기지 않으면 매번 다른 배치, 같은 난수(매일 도전)면 항상 같은 배치
  function create(difficulty, { daily = null, random = Math.random } = {}) {
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const symbols = Common.shuffle(SYMBOLS.slice(), random).slice(0, config.pairs);
    const deck = Common.shuffle([...symbols, ...symbols], random);
    return {
      difficulty,
      daily,
      cards: deck.map((symbol) => ({ symbol, matched: false })),
      open: [], // 지금 앞면인(아직 짝이 안 된) 카드 번호
      attempts: 0, // 두 장씩 뒤집은 횟수
      elapsed: 0,
      started: false,
    };
  }

  // 결과: 'ignored' | 'first'(한 장 뒤집음) | 'match' | 'miss'(틀림, 두 장이 열린 채 남음) | 'done'(모두 맞춤)
  function flip(state, index) {
    const card = state.cards[index];
    if (!card || card.matched) return 'ignored';
    // 틀린 두 장이 아직 열려 있으면 먼저 덮는다(그중 한 장을 다시 눌러도 새로 뒤집기로 친다).
    if (state.open.length === 2) state.open = [];
    if (state.open.includes(index)) return 'ignored';
    state.started = true;
    state.open.push(index);
    if (state.open.length === 1) return 'first';

    state.attempts++;
    const [a, b] = state.open;
    if (state.cards[a].symbol !== state.cards[b].symbol) return 'miss';
    state.cards[a].matched = true;
    state.cards[b].matched = true;
    state.open = [];
    return isDone(state) ? 'done' : 'match';
  }

  // 틀린 두 장을 덮는다(잠시 보여 준 뒤).
  function hideMiss(state) {
    if (state.open.length === 2) state.open = [];
  }

  const isDone = (state) => state.cards.every((card) => card.matched);
  const matchedPairs = (state) => state.cards.filter((card) => card.matched).length / 2;

  function isValid(state) {
    return Boolean(state) && typeof state === 'object'
      && DIFFICULTIES[state.difficulty] !== undefined
      && Array.isArray(state.cards) && state.cards.length === DIFFICULTIES[state.difficulty].pairs * 2
      && state.cards.every((card) => card && typeof card.symbol === 'string' && typeof card.matched === 'boolean')
      && Array.isArray(state.open) && Number.isInteger(state.attempts) && Number.isFinite(state.elapsed);
  }

  return { SYMBOLS, DIFFICULTIES, DAILY_DIFFICULTY, create, flip, hideMiss, isDone, matchedPairs, isValid };
})();

if (typeof module !== 'undefined') module.exports = MemoryGame;
