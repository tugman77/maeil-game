// 프리셀: 빈 프리셀·빈 줄을 실제로 이용할 수 있는 만큼만 묶음 이동을 허용한다.
const FreeCellGame = (() => {
  const M = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const DEALS = typeof FreeCellDeals !== 'undefined' ? FreeCellDeals : require('./deals.js');
  const SUITS = ['♠', '♥', '♣', '♦'], SUIT_NAMES = ['스페이드', '하트', '클로버', '다이아몬드'];
  const DIFFICULTIES = {
    easy: { label: '쉬움', detail: '풀이 검증 판 · 비교적 짧은 수순' },
    medium: { label: '보통', detail: '풀이 검증 판 · 기본 프리셀' },
    hard: { label: '어려움', detail: '풀이 검증 판 · 더 긴 수순' },
  };
  const DAILY_DIFFICULTY = 'medium', HISTORY_LIMIT = 200;
  const suit = (card) => Math.floor(card / 13), rank = (card) => card % 13 + 1;
  const red = (card) => suit(card) % 2 === 1;
  const rankText = (card) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank(card)] || String(rank(card));
  const cardText = (card) => `${rankText(card)}${SUITS[suit(card)]}`;
  const cardName = (card) => `${SUIT_NAMES[suit(card)]} ${rankText(card)}`;
  const snapshot = (s) => ({ columns: s.columns.map((c) => c.slice()), free: s.free.slice(), foundations: s.foundations.slice() });
  const positionKey = (s) => `${s.foundations.join(',')}|${s.free.map((v) => v === null ? '-' : v).join(',')}|${s.columns.map((c) => c.join(',')).join(';')}`;
  const foundationCount = (s) => s.foundations.reduce((a, n) => a + n, 0);
  const isDone = (s) => foundationCount(s) === 52;
  const fits = (card, under) => rank(under) === rank(card) + 1 && red(card) !== red(under);
  const runOK = (cards) => cards.length > 0 && cards.slice(1).every((card, i) => fits(card, cards[i]));

  function sourceCards(s, from) {
    if (!from || !Number.isInteger(from.index)) return null;
    if (from.type === 'free' && from.index >= 0 && from.index < 4) return s.free[from.index] === null ? null : [s.free[from.index]];
    if (from.type !== 'column' || from.index < 0 || from.index >= 8 || !Number.isInteger(from.start)) return null;
    const column = s.columns[from.index];
    if (from.start < 0 || from.start >= column.length) return null;
    const cards = column.slice(from.start); return runOK(cards) ? cards : null;
  }
  function capacity(s, destination) {
    const free = s.free.filter((v) => v === null).length;
    const empty = s.columns.filter((c) => !c.length).length - Number(s.columns[destination]?.length === 0);
    return (free + 1) * 2 ** Math.max(0, empty);
  }
  function canMove(s, from, to) {
    if (!to || !Number.isInteger(to.index)) return false;
    if (from?.type === to.type && from.index === to.index) return false;
    const cards = sourceCards(s, from); if (!cards) return false;
    if (to.type === 'free') return cards.length === 1 && to.index >= 0 && to.index < 4 && s.free[to.index] === null;
    if (to.type === 'foundation') return cards.length === 1 && to.index >= 0 && to.index < 4
      && suit(cards[0]) === to.index && rank(cards[0]) === s.foundations[to.index] + 1;
    if (to.type !== 'column' || to.index < 0 || to.index >= 8) return false;
    const target = s.columns[to.index];
    return (!target.length || fits(cards[0], target.at(-1))) && cards.length <= capacity(s, to.index);
  }
  function apply(s, from, to) {
    if (!canMove(s, from, to)) return false;
    const cards = sourceCards(s, from);
    if (from.type === 'free') s.free[from.index] = null;
    else s.columns[from.index].splice(from.start);
    if (to.type === 'free') s.free[to.index] = cards[0];
    else if (to.type === 'foundation') s.foundations[to.index]++;
    else s.columns[to.index].push(...cards);
    return true;
  }
  function remember(s) {
    s.history.push({ ...snapshot(s), moves: s.moves });
    if (s.history.length > HISTORY_LIMIT) s.history.shift();
  }
  function move(s, from, to) {
    if (!canMove(s, from, to)) return false;
    remember(s); apply(s, from, to); s.moves++; s.started = true; return true;
  }
  function undo(s) {
    const previous = s.history.pop(); if (!previous) return false;
    Object.assign(s, previous); s.undoUsed++; return true;
  }
  function safeForFoundation(s, card) {
    const r = rank(card), c = suit(card);
    if (r !== s.foundations[c] + 1) return false;
    return r <= 2 || s.foundations.every((n, other) => other === c || n >= r - (other % 2 !== c % 2 ? 1 : 2));
  }
  function safeMove(s) {
    for (let i = 0; i < 8; i++) {
      const card = s.columns[i].at(-1);
      if (card !== undefined && safeForFoundation(s, card)) return { from: { type: 'column', index: i, start: s.columns[i].length - 1 }, to: { type: 'foundation', index: suit(card) } };
    }
    for (let i = 0; i < 4; i++) {
      const card = s.free[i];
      if (card !== null && safeForFoundation(s, card)) return { from: { type: 'free', index: i }, to: { type: 'foundation', index: suit(card) } };
    }
    return null;
  }
  function autoFoundation(s) {
    let next = safeMove(s), count = 0;
    if (!next) return 0;
    remember(s);
    while (next) { apply(s, next.from, next.to); count++; next = safeMove(s); }
    s.moves += count; s.started = true; return count;
  }
  function legalMoves(s) {
    const sources = [];
    s.columns.forEach((column, index) => {
      for (let start = column.length - 1; start >= 0; start--) {
        if (!runOK(column.slice(start))) break;
        sources.push({ type: 'column', index, start });
      }
    });
    s.free.forEach((card, index) => { if (card !== null) sources.push({ type: 'free', index }); });
    const result = [];
    const emptyFree = s.free.indexOf(null), emptyColumn = s.columns.findIndex((c) => !c.length);
    for (const from of sources) {
      const cards = sourceCards(s, from);
      const destinations = [{ type: 'foundation', index: suit(cards[0]) }];
      if (emptyFree >= 0 && from.type === 'column') destinations.push({ type: 'free', index: emptyFree });
      for (let i = 0; i < 8; i++) {
        if (!s.columns[i].length && i !== emptyColumn) continue;
        // 줄 전체를 빈 줄로 옮기기만 하는 대칭 이동은 추천·탐색에서 제외한다.
        if (i === emptyColumn && from.type === 'column' && from.start === 0) continue;
        destinations.push({ type: 'column', index: i });
      }
      for (const to of destinations) if (canMove(s, from, to)) result.push({ from, to });
    }
    return result;
  }
  function rawDeal(number) {
    const random = M.createSeededRandom(`freecell:raw:${number}`);
    const deck = M.shuffle(Array.from({ length: 52 }, (_, i) => i), random);
    const columns = Array.from({ length: 8 }, () => []);
    deck.forEach((card, i) => columns[i % 8].push(card));
    return { columns, free: Array(4).fill(null), foundations: Array(4).fill(0) };
  }
  function verifySolution(position, moves) {
    const s = snapshot(position);
    for (const m of moves) if (!apply(s, m.from, m.to)) return false;
    return isDone(s);
  }
  function create(difficulty, { daily = null, dealNumber, random = Math.random } = {}) {
    if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('알 수 없는 난이도');
    if (dealNumber === undefined) dealNumber = Math.floor(random() * 0x100000000);
    if (!Number.isInteger(dealNumber) || dealNumber < 0 || dealNumber > 0xffffffff) throw new Error('잘못된 판 번호');
    const randomDeal = M.createSeededRandom(`freecell:deal:${difficulty}:${dealNumber}`);
    const group = DEALS.filter((d) => d.difficulty === difficulty);
    if (!group.length) throw new Error('검증한 프리셀 판이 없습니다.');
    const entry = group[Math.floor(randomDeal() * group.length)];
    const original = rawDeal(entry.seed);
    const permutation = M.shuffle(Array.from({ length: 8 }, (_, i) => i), randomDeal);
    let blacks = M.shuffle([0, 2], randomDeal), reds = M.shuffle([1, 3], randomDeal);
    if (randomDeal() < .5) [blacks, reds] = [reds, blacks];
    const suits = [blacks[0], reds[0], blacks[1], reds[1]];
    const initial = { columns: Array.from({ length: 8 }, () => []), free: Array(4).fill(null), foundations: Array(4).fill(0) };
    original.columns.forEach((column, i) => { initial.columns[permutation[i]] = column.map((card) => suits[suit(card)] * 13 + rank(card) - 1); });
    const transform = (loc) => ({ ...loc, index: loc.type === 'column' ? permutation[loc.index] : loc.type === 'foundation' ? suits[loc.index] : loc.index });
    const solution = entry.solution.map((m) => ({ from: transform(m.from), to: transform(m.to) }));
    if (!verifySolution(initial, solution)) throw new Error('프리셀 풀이 검증 실패');
    return { version: 1, difficulty, daily, dealNumber, baseDeal: entry.seed, initial, solution,
      ...snapshot(initial), history: [], moves: 0, undoUsed: 0, hintsUsed: 0, elapsed: 0, started: false };
  }
  function solutionMap(s) {
    const map = new Map(), position = snapshot(s.initial);
    for (const move of s.solution) {
      map.set(positionKey(position), move);
      if (!apply(position, move.from, move.to)) return new Map();
    }
    return map;
  }
  function hint(s, map) {
    const certified = map?.get(positionKey(s));
    if (certified && canMove(s, certified.from, certified.to)) return { ...certified, certified: true };
    const safe = safeMove(s); if (safe) return { ...safe, certified: false };
    const previous = s.history.length ? positionKey(s.history.at(-1)) : null;
    let best = null, score = -Infinity;
    for (const m of legalMoves(s)) {
      const next = snapshot(s); apply(next, m.from, m.to);
      if (positionKey(next) === previous) continue;
      let value = foundationCount(next) * 20 + next.columns.filter((c) => !c.length).length * 8
        + next.free.filter((c) => c === null).length * 3;
      next.columns.forEach((c) => c.forEach((card, i) => { value -= Math.max(0, 6 - rank(card)) * (c.length - i - 1); }));
      if (value > score) { best = m; score = value; }
    }
    return best ? { ...best, certified: false } : legalMoves(s)[0] || null;
  }
  function validPosition(s) {
    if (!s || !Array.isArray(s.columns) || s.columns.length !== 8 || !Array.isArray(s.free) || s.free.length !== 4
      || !Array.isArray(s.foundations) || s.foundations.length !== 4) return false;
    if (!s.foundations.every((n) => Number.isInteger(n) && n >= 0 && n <= 13)) return false;
    const seen = new Set();
    s.foundations.forEach((n, suit) => { for (let i = 0; i < n; i++) seen.add(suit * 13 + i); });
    const accept = (card) => {
      if (!Number.isInteger(card) || card < 0 || card >= 52 || seen.has(card)) return false;
      seen.add(card); return true;
    };
    for (const column of s.columns) if (!Array.isArray(column) || column.length > 52 || !column.every(accept)) return false;
    if (!s.free.every((card) => card === null || accept(card))) return false;
    return seen.size === 52;
  }
  function isValid(s) {
    if (!s || s.version !== 1 || !Object.hasOwn(DIFFICULTIES, s.difficulty) || !validPosition(s) || !validPosition(s.initial)) return false;
    if (s.daily !== null && (typeof s.daily !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.daily) || s.difficulty !== DAILY_DIFFICULTY)) return false;
    if (!Number.isInteger(s.dealNumber) || s.dealNumber < 0 || s.dealNumber > 0xffffffff || !Number.isInteger(s.baseDeal)) return false;
    if (!s.initial.free.every((v) => v === null) || s.initial.foundations.some(Boolean)
      || s.initial.columns.some((c) => c.length !== 6 && c.length !== 7)) return false;
    if (!Array.isArray(s.solution) || s.solution.length > 600 || !s.solution.every((m) => m && m.from && m.to)) return false;
    if (!verifySolution(s.initial, s.solution)) return false;
    if (!Array.isArray(s.history) || s.history.length > HISTORY_LIMIT || !s.history.every((h) => validPosition(h) && Number.isSafeInteger(h.moves) && h.moves >= 0)) return false;
    return ['moves', 'undoUsed', 'hintsUsed'].every((k) => Number.isSafeInteger(s[k]) && s[k] >= 0)
      && Number.isFinite(s.elapsed) && s.elapsed >= 0 && typeof s.started === 'boolean';
  }
  return { SUITS, SUIT_NAMES, DIFFICULTIES, DAILY_DIFFICULTY, HISTORY_LIMIT, suit, rank, red, rankText,
    cardText, cardName, fits, runOK, sourceCards, capacity, canMove, apply, move, undo, safeForFoundation,
    safeMove, autoFoundation, legalMoves, snapshot, positionKey, foundationCount, isDone, rawDeal,
    verifySolution, create, solutionMap, hint, validPosition, isValid };
})();
if (typeof module !== 'undefined') module.exports = FreeCellGame;
