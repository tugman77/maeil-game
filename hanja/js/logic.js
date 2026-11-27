const HanjaGame = (() => {
  const M = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const B = typeof HanjaBank !== 'undefined' ? HanjaBank : require('./bank.js');
  const ID = 'hanja', COUNT = 5;
  const LANGS = B.languages;
  const MODES = { read:'읽기', write:'쓰기', listen:'듣기' };
  const LEVELS = {
    easy:{ label:'쉬움', detail:'기초 한자와 익숙한 단어' },
    medium:{ label:'보통', detail:'생활에서 자주 보는 단어' },
    hard:{ label:'어려움', detail:'문장 속 단어와 읽기' },
  };
  const shuffle = (list, rng) => M.shuffle([...list], rng);
  function create({ lang='zh', mode='read', level='easy', daily=null, random=Math.random }={}) {
    if (!Object.hasOwn(LANGS, lang) || !Object.hasOwn(MODES, mode) || !Object.hasOwn(LEVELS, level)) throw Error('학습 설정을 확인해 주세요.');
    if (daily !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(daily)) throw Error('날짜가 올바르지 않습니다.');
      random = M.dailyRandom(`${ID}-${lang}-${mode}`, daily);
      level = 'medium';
    }
    let rounds;
    if (mode === 'write') {
      const pool = shuffle(B.strokes, random).slice(0, COUNT);
      rounds = pool.map((item) => ({ item: item.char, options:[], attempts:[], status:'playing', stroke:0, guide: level === 'easy' ? 'all' : level === 'medium' ? 'current' : 'none' }));
    } else {
      const pool = (B.items[lang] || []).filter((item) => item.level === level);
      if (pool.length < COUNT) throw Error('문제 수가 부족합니다.');
      rounds = shuffle(pool, random).slice(0, COUNT).map((item) => {
        const options = mode === 'read' ? [item.meaning] : [item.reading];
        const distractors = shuffle(pool.filter((other) => other.id !== item.id).map((other) => mode === 'read' ? other.meaning : other.reading).filter((x) => !options.includes(x)), random);
        options.push(...distractors.slice(0, 2));
        return { item:item.id, options:shuffle(options, random), attempts:[], status:'playing', stroke:0, guide:'none' };
      });
    }
    return { version:1, bankVersion:B.version, lang, mode, level, daily, index:0, correct:0, rounds };
  }
  const current = (s) => s?.rounds?.[s.index] || null;
  const itemFor = (s, round=current(s)) => s?.mode === 'write' ? B.strokes.find((item) => item.char === round?.item) : (B.items[s?.lang] || []).find((item) => item.id === round?.item);
  const done = (s) => s?.index === COUNT;
  function answer(s, index) {
    const r=current(s), item=itemFor(s,r);
    if (!r || !item || r.status !== 'playing' || !Number.isInteger(index) || index < 0 || index >= r.options.length || r.attempts.includes(index)) return 'inactive';
    const expected = s.mode === 'read' ? item.meaning : item.reading;
    if (r.options[index] === expected) { r.status='correct'; s.correct++; return 'correct'; }
    r.attempts.push(index);
    if (r.attempts.length >= r.options.length - 1) { r.status='revealed'; return 'revealed'; }
    return 'wrong';
  }
  function strokeDone(s) {
    const r=current(s), item=itemFor(s,r);
    if (!r || !item || s.mode !== 'write' || r.status !== 'playing') return false;
    r.stroke++;
    if (r.stroke >= item.paths.length) { r.status='correct'; s.correct++; return true; }
    return false;
  }
  function reveal(s) {
    const r=current(s);
    if (!r || r.status !== 'playing') return false;
    r.status='revealed'; return true;
  }
  function next(s) {
    if (!current(s) || current(s).status === 'playing') return false;
    s.index++;
    return true;
  }
  function score(s) { return { correct:s.correct, revealed:s.rounds.filter((r)=>r.status==='revealed').length }; }
  function isValid(s) {
    try {
      if (!s || s.version!==1 || s.bankVersion!==B.version || !Object.hasOwn(LANGS,s.lang) || !Object.hasOwn(MODES,s.mode) || !Object.hasOwn(LEVELS,s.level) || !Array.isArray(s.rounds) || s.rounds.length!==COUNT || !Number.isInteger(s.index) || s.index<0 || s.index>COUNT || !Number.isInteger(s.correct) || s.correct<0 || s.correct>COUNT) return false;
      if (s.daily!==null && (typeof s.daily!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.daily))) return false;
      const bank = s.mode==='write' ? B.strokes : (B.items[s.lang]||[]).filter((q)=>q.level===s.level);
      const ids = bank.map((q)=>s.mode==='write'?q.char:q.id);
      if (new Set(s.rounds.map((r)=>r.item)).size!==COUNT || s.rounds.some((r)=>!ids.includes(r.item))) return false;
      let correct=0;
      for (let i=0;i<COUNT;i++) {
        const r=s.rounds[i];
        if (!Array.isArray(r.attempts) || !['playing','correct','revealed'].includes(r.status) || !Number.isInteger(r.stroke) || r.stroke<0) return false;
        if (s.mode==='write') {
          const q=itemFor(s,r);
          if (!q || r.stroke>q.paths.length || r.options.length!==0 || !['all','current','none'].includes(r.guide)) return false;
          if (r.status==='correct' && r.stroke!==q.paths.length) return false;
        } else {
          if (!Array.isArray(r.options) || r.options.length!==3 || new Set(r.options).size!==3 || r.attempts.some((x)=>!Number.isInteger(x)||x<0||x>=3)) return false;
          const q=itemFor(s,r), expected=s.mode==='read'?q.meaning:q.reading;
          if (!r.options.includes(expected) || r.attempts.some((x)=>r.options[x]===expected)) return false;
        }
        if (r.status==='correct') correct++;
        if (i<s.index && r.status==='playing') return false;
        if (i>s.index && (r.status!=='playing'||r.stroke!==0||r.attempts.length)) return false;
      }
      return correct===s.correct;
    } catch { return false; }
  }
  function shareText(s) {
    const lang=LANGS[s.lang].label, mode=MODES[s.mode];
    return `[매일게임 오늘의 한자] ${lang} · ${mode}\n맞힌 문제 ${s.correct}/${COUNT}\n한자를 가볍게 익혀 보세요!`;
  }
  return { ID, COUNT, LANGS, MODES, LEVELS, create, current, itemFor, done, answer, strokeDone, reveal, next, score, isValid, shareText };
})();
if (typeof module !== 'undefined') module.exports = HanjaGame;
