const ProverbQuiz = (() => {
  const M = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const B = typeof ProverbQuizBank !== 'undefined' ? ProverbQuizBank : require('./bank.js');
  const ID = 'proverb-quiz', COUNT = 5, DAILY_DIFFICULTY = 'medium';
  const DIFFICULTIES = {
    easy: { label:'쉬움', detail:'많이 알려진 속담 5문제' },
    medium: { label:'보통', detail:'익숙한 속담 5문제' },
    hard: { label:'어려움', detail:'뜻을 생각하는 속담 5문제' },
  };
  const byId = new Map(B.questions.map(q => [q.id, q]));
  const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    && Number.isFinite(Date.parse(d + 'T00:00:00Z'))
    && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;

  function create(difficulty = 'medium', { daily = null, random = Math.random } = {}) {
    if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw Error('잘못된 난이도');
    if (daily !== null) {
      if (!validDate(daily)) throw Error('잘못된 날짜');
      difficulty = DAILY_DIFFICULTY;
      random = M.dailyRandom(ID, daily);
    }
    const pool = M.shuffle(B.questions.filter(q => q.level === difficulty), random);
    if (pool.length < COUNT) throw Error('문제 수가 부족합니다');
    return {
      version: 1, bankVersion: B.version, difficulty, daily, index: 0, started: false,
      rounds: pool.slice(0, COUNT).map(q => ({
        id: q.id, options: M.shuffle([...q.choices], random), attempts: [], hints: 0,
        status: 'playing', chosen: -1,
      })),
    };
  }
  const current = s => s.rounds[s.index];
  const question = s => byId.get(current(s)?.id);
  const isDone = s => s.index === COUNT;
  const score = s => ({
    correct: s.rounds.filter(r => r.status === 'correct').length,
    revealed: s.rounds.filter(r => r.status === 'revealed').length,
    hints: s.rounds.reduce((n, r) => n + r.hints, 0),
    mistakes: s.rounds.reduce((n, r) => n + r.attempts.length, 0),
  });
  function choose(s, index) {
    if (isDone(s) || current(s).status !== 'playing' || !Number.isInteger(index)
      || index < 0 || index >= current(s).options.length || current(s).attempts.includes(index)) return 'inactive';
    const r = current(s), q = question(s);
    s.started = true;
    if (r.options[index] === q.answer) {
      r.status = 'correct'; r.chosen = index; return 'correct';
    }
    r.attempts.push(index); return 'wrong';
  }
  function hint(s) {
    if (isDone(s) || current(s).status !== 'playing' || current(s).hints >= 2) return false;
    current(s).hints++; s.started = true; return true;
  }
  function hintText(s) {
    const r = current(s), q = question(s);
    if (!r || !q || !r.hints) return '';
    if (r.hints === 1) return q.hint;
    const firstWord = q.answer.split(' ')[0];
    return `한 번 더 힌트: 정답은 ‘${firstWord}’로 시작해요.`;
  }
  function reveal(s) {
    if (isDone(s) || current(s).status !== 'playing') return false;
    current(s).status = 'revealed'; s.started = true; return true;
  }
  function next(s) {
    if (isDone(s) || current(s).status === 'playing') return false;
    s.index++; return true;
  }
  function isValid(s) {
    try {
      if (!s || s.version !== 1 || s.bankVersion !== B.version || !Object.hasOwn(DIFFICULTIES, s.difficulty)
        || (s.daily !== null && (!validDate(s.daily) || s.difficulty !== DAILY_DIFFICULTY))
        || !Number.isInteger(s.index) || s.index < 0 || s.index > COUNT || typeof s.started !== 'boolean'
        || !Array.isArray(s.rounds) || s.rounds.length !== COUNT
        || new Set(s.rounds.map(r => r.id)).size !== COUNT) return false;
      return s.rounds.every((r, i) => {
        const q = byId.get(r.id);
        if (!q || q.level !== s.difficulty || !Array.isArray(r.options) || r.options.length !== 3
          || new Set(r.options).size !== 3 || r.options.some(x => !q.choices.includes(x))
          || !Array.isArray(r.attempts) || new Set(r.attempts).size !== r.attempts.length
          || r.attempts.some(x => !Number.isInteger(x) || x < 0 || x >= r.options.length || r.options[x] === q.answer)
          || !Number.isInteger(r.hints) || r.hints < 0 || r.hints > 2
          || !['playing', 'correct', 'revealed'].includes(r.status) || !Number.isInteger(r.chosen)) return false;
        if (r.status === 'correct' && (r.chosen < 0 || r.options[r.chosen] !== q.answer)) return false;
        if (r.status !== 'correct' && r.chosen !== -1) return false;
        if (i < s.index && r.status === 'playing') return false;
        if (i > s.index && (r.status !== 'playing' || r.attempts.length || r.hints)) return false;
        if (!s.started && (r.status !== 'playing' || r.attempts.length || r.hints)) return false;
        return true;
      });
    } catch { return false; }
  }
  function shareText(s) {
    const result = score(s), title = s.daily ? `${s.daily} 오늘의 도전` : DIFFICULTIES[s.difficulty].label;
    return `[매일게임 속담 완성] ${title}\n직접 맞힘 ${result.correct}/${COUNT} · 힌트 ${result.hints}회\n${s.rounds.map(r => r.status === 'correct' ? '●' : '○').join(' ')}\n속담을 함께 완성해 보세요!`;
  }
  return { ID, COUNT, DAILY_DIFFICULTY, DIFFICULTIES, create, current, question, isDone, score, choose, hint, hintText, reveal, next, isValid, shareText };
})();
if (typeof module !== 'undefined') module.exports = ProverbQuiz;
