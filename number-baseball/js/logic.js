// 숫자야구: 숫자·자리가 같으면 스트라이크, 숫자만 같으면 볼. 첫 자리 0·중복 숫자 금지.
const NumberBaseball = (() => {
  const M = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const DIFFICULTIES = {
    easy: { label: '쉬움', digits: 3, pool: '123456', candidates: true, detail: '세 자리 · 1~6 사용 · 남은 후보 수 표시' },
    medium: { label: '보통', digits: 3, pool: '0123456789', candidates: false, detail: '세 자리 · 0~9 사용 · 첫 자리 0 제외' },
    hard: { label: '어려움', digits: 4, pool: '0123456789', candidates: false, detail: '네 자리 · 0~9 사용 · 첫 자리 0 제외' },
  };
  const DAILY_DIFFICULTY = 'medium';
  const MAX_DRAFT_HISTORY = 40;
  const CANDIDATES = {};
  const copyDraft = (s) => ({ draft: s.draft.slice(), cursor: s.cursor });
  const isDone = (s) => s.status === 'won';

  function validNumber(text, config) {
    return typeof text === 'string' && text.length === config.digits
      && text[0] !== '0' && new Set(text).size === config.digits
      && [...text].every((n) => config.pool.includes(n));
  }
  function evaluate(answer, guess) {
    let strikes = 0, common = 0;
    for (let i = 0; i < guess.length; i++) {
      if (answer[i] === guess[i]) strikes++;
      if (answer.includes(guess[i])) common++;
    }
    return { strikes, balls: common - strikes };
  }
  function candidates(difficulty) {
    if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('알 수 없는 난이도');
    if (!CANDIDATES[difficulty]) {
      const config = DIFFICULTIES[difficulty], list = [];
      function build(prefix) {
        if (prefix.length === config.digits) { list.push(prefix); return; }
        for (const digit of config.pool) {
          if ((!prefix && digit === '0') || prefix.includes(digit)) continue;
          build(prefix + digit);
        }
      }
      build(''); CANDIDATES[difficulty] = Object.freeze(list);
    }
    return CANDIDATES[difficulty];
  }
  function create(difficulty, { daily = null, random = Math.random } = {}) {
    if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('알 수 없는 난이도');
    const config = DIFFICULTIES[difficulty];
    if (!config) throw new Error('알 수 없는 난이도');
    const options = candidates(difficulty);
    const answer = options[Math.floor(random() * options.length)];
    return { version: 1, difficulty, daily, answer, guesses: [],
      draft: Array(config.digits).fill(''), cursor: 0, draftHistory: [],
      hintsUsed: 0, status: 'playing', elapsed: 0, started: false };
  }
  function remember(s) {
    s.draftHistory.push(copyDraft(s));
    if (s.draftHistory.length > MAX_DRAFT_HISTORY) s.draftHistory.shift();
  }
  function putDigit(s, digit) {
    if (isDone(s)) return 'done';
    const config = DIFFICULTIES[s.difficulty];
    if (typeof digit !== 'string' || digit.length !== 1 || !config.pool.includes(digit)) return 'range';
    if (s.cursor === 0 && digit === '0') return 'leading-zero';
    if (s.draft.some((n, i) => i !== s.cursor && n === digit)) return 'duplicate';
    if (s.draft[s.cursor] === digit) return 'ignored';
    remember(s); s.draft[s.cursor] = digit; s.started = true;
    // 다음 빈자리로 이동한다. 모두 채워졌으면 현재 자리를 유지한다.
    for (let step = 1; step < config.digits; step++) {
      const next = (s.cursor + step) % config.digits;
      if (!s.draft[next]) { s.cursor = next; break; }
    }
    return 'ok';
  }
  function erase(s) {
    if (isDone(s)) return false;
    let index = s.cursor;
    while (index >= 0 && !s.draft[index]) index--;
    if (index < 0) index = s.draft.findLastIndex(Boolean);
    if (index < 0) return false;
    remember(s); s.draft[index] = ''; s.cursor = index; return true;
  }
  function clear(s) {
    if (isDone(s) || !s.draft.some(Boolean)) return false;
    remember(s); s.draft.fill(''); s.cursor = 0; return true;
  }
  function undoDraft(s) {
    if (isDone(s) || !s.draftHistory.length) return false;
    const before = s.draftHistory.pop(); s.draft = before.draft; s.cursor = before.cursor; return true;
  }
  function paste(s, text) {
    if (isDone(s) || !validNumber(text, DIFFICULTIES[s.difficulty])) return false;
    remember(s); s.draft = [...text]; s.cursor = s.draft.length - 1; s.started = true; return true;
  }
  function submit(s) {
    if (isDone(s)) return { status: 'done' };
    const text = s.draft.join(''), config = DIFFICULTIES[s.difficulty];
    if (!validNumber(text, config)) return { status: 'incomplete' };
    const previous = s.guesses.findIndex((g) => g.number === text);
    if (previous >= 0) return { status: 'repeated', attempt: previous + 1 };
    const result = evaluate(s.answer, text);
    s.guesses.push({ number: text, ...result }); s.started = true;
    s.draft.fill(''); s.cursor = 0; s.draftHistory = [];
    if (result.strikes === config.digits) s.status = 'won';
    return { status: isDone(s) ? 'won' : 'accepted', ...result };
  }
  function reveal(s) {
    const config = DIFFICULTIES[s.difficulty];
    if (isDone(s) || s.hintsUsed >= config.digits - 1) return null;
    const position = s.hintsUsed++;
    s.started = true;
    return { position, digit: s.answer[position] };
  }
  function remainingCandidates(s) {
    return candidates(s.difficulty).filter((answer) => {
      if (!answer.startsWith(s.answer.slice(0, s.hintsUsed))) return false;
      return s.guesses.every((guess) => {
        const result = evaluate(answer, guess.number);
        return result.strikes === guess.strikes && result.balls === guess.balls;
      });
    });
  }
  function isValid(s) {
    if (!s || typeof s !== 'object' || s.version !== 1 || !Object.hasOwn(DIFFICULTIES, s.difficulty)) return false;
    const config = DIFFICULTIES[s.difficulty];
    if (!validNumber(s.answer, config) || !['playing', 'won'].includes(s.status)) return false;
    if (s.daily !== null && (typeof s.daily !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.daily) || s.difficulty !== DAILY_DIFFICULTY)) return false;
    if (!Number.isFinite(s.elapsed) || s.elapsed < 0 || typeof s.started !== 'boolean') return false;
    if (!Number.isInteger(s.hintsUsed) || s.hintsUsed < 0 || s.hintsUsed >= config.digits) return false;
    const draftOK = (draft, cursor) => {
      if (!Array.isArray(draft) || draft.length !== config.digits || !Number.isInteger(cursor) || cursor < 0 || cursor >= config.digits) return false;
      const filled = draft.filter((n) => n !== '');
      return draft[0] !== '0' && new Set(filled).size === filled.length
        && draft.every((n) => n === '' || (typeof n === 'string' && n.length === 1 && config.pool.includes(n)));
    };
    if (!draftOK(s.draft, s.cursor) || !Array.isArray(s.draftHistory) || s.draftHistory.length > MAX_DRAFT_HISTORY
      || !s.draftHistory.every((h) => h && draftOK(h.draft, h.cursor))) return false;
    if (!Array.isArray(s.guesses) || s.guesses.length > candidates(s.difficulty).length) return false;
    const seen = new Set();
    for (let i = 0; i < s.guesses.length; i++) {
      const guess = s.guesses[i];
      if (!guess || !validNumber(guess.number, config) || seen.has(guess.number)) return false;
      const score = evaluate(s.answer, guess.number);
      if (guess.strikes !== score.strikes || guess.balls !== score.balls) return false;
      if (score.strikes === config.digits && (i !== s.guesses.length - 1 || !isDone(s))) return false;
      seen.add(guess.number);
    }
    if (isDone(s) !== Boolean(s.guesses.at(-1)?.strikes === config.digits)) return false;
    if (!s.started && (s.hintsUsed || s.guesses.length || s.draft.some(Boolean))) return false;
    return true;
  }
  function shareText(s) {
    const title = s.daily ? `${M.dateLabel(s.daily)} 오늘의 도전` : DIFFICULTIES[s.difficulty].label;
    const recent = s.guesses.slice(-6).map((g) => `${g.strikes}S ${g.balls}B`).join('\n');
    return `[매일게임 숫자야구] ${title}\n${s.guesses.length}번 만에 정답 · 자리 힌트 ${s.hintsUsed}회\n${s.guesses.length > 6 ? '최근 6번의 결과\n' : ''}${recent}\n같이 추리해 보세요!`;
  }
  return { DIFFICULTIES, DAILY_DIFFICULTY, MAX_DRAFT_HISTORY, validNumber, evaluate, candidates,
    create, isDone, putDigit, erase, clear, undoDraft, paste, submit, reveal, remainingCandidates, isValid, shareText };
})();
if (typeof module !== 'undefined') module.exports = NumberBaseball;
