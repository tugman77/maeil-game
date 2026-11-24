const InitialQuiz = (() => {
  const M=typeof MaeilGame!=='undefined'?MaeilGame:require('../../common/core.js');
  const W=typeof InitialQuizWords!=='undefined'?InitialQuizWords:require('./words.js');
  const INITIALS=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
  const DIFFICULTIES={easy:{label:'쉬움',length:2,detail:'두 글자 · 생활 낱말 5문제'},medium:{label:'보통',length:3,detail:'세 글자 · 생활 낱말 5문제'},hard:{label:'어려움',length:4,detail:'네 글자 · 생활 낱말 5문제'}};
  const COUNT=5,DAILY_DIFFICULTY='medium',HISTORY_LIMIT=40;
  const DISTRACTORS=[...'하바소리무나도구지마우개장방손꽃물산달별차집옷눈돌길책밥콩배'];
  const byId=new Map(W.questions.map(q=>[q.id,q]));
  const normalize=s=>typeof s==='string'?s.normalize('NFC').replace(/\s/gu,''):'';
  const initials=s=>[...normalize(s)].map(c=>{
    const n=c.codePointAt(0)-0xac00;return n>=0&&n<11172?INITIALS[Math.floor(n/588)]:c;
  }).join('');
  const length=q=>normalize(q.answers[0]).length;
  function required(q) {
    const bag={};for(const answer of q.answers) {
      const counts={};for(const c of normalize(answer))counts[c]=(counts[c]||0)+1;
      for(const [c,n] of Object.entries(counts))bag[c]=Math.max(bag[c]||0,n);
    }
    return Object.entries(bag).flatMap(([c,n])=>Array(n).fill(c));
  }
  function makeTiles(q,random) {
    const core=required(q),extra=M.shuffle(DISTRACTORS.filter(c=>!core.includes(c)),random).slice(0,4);
    return M.shuffle([...core,...extra],random);
  }
  function create(difficulty='medium',{daily=null,random=Math.random}={}) {
    if(!Object.hasOwn(DIFFICULTIES,difficulty))throw Error('잘못된 난이도');
    if(daily) {if(!validDate(daily))throw Error('잘못된 날짜');difficulty=DAILY_DIFFICULTY;random=M.dailyRandom('initial-quiz',daily);}
    const pool=M.shuffle(W.questions.filter(q=>length(q)===DIFFICULTIES[difficulty].length),random);
    const chosen=[],categories=new Set();
    for(const q of pool)if(!categories.has(q.category)&&chosen.length<COUNT){chosen.push(q);categories.add(q.category);}
    for(const q of pool)if(!chosen.includes(q)&&chosen.length<COUNT)chosen.push(q);
    return {version:1,bankVersion:W.version,difficulty,daily,index:0,started:false,elapsed:0,
      rounds:chosen.map(q=>({id:q.id,tiles:makeTiles(q,random),draft:[],history:[],attempts:[],hints:0,status:'playing',answer:''}))};
  }
  const current=s=>s.rounds[s.index];
  const question=s=>byId.get(current(s)?.id);
  const draft=s=>current(s).draft.map(x=>x.letter).join('');
  const isDone=s=>s.index===COUNT;
  const active=s=>!isDone(s)&&current(s).status==='playing';
  const copy=a=>a.map(x=>({...x}));
  function edit(s,items) {
    const r=current(s);if(!active(s)||JSON.stringify(r.draft)===JSON.stringify(items))return false;
    r.history.push(copy(r.draft));if(r.history.length>HISTORY_LIMIT)r.history.shift();r.draft=items;s.started=true;return true;
  }
  function addTile(s,index) {
    if(!active(s))return false;const r=current(s),q=question(s);
    if(!Number.isInteger(index)||index<0||index>=r.tiles.length||r.draft.length>=length(q)||r.draft.some(x=>x.tile===index))return false;
    return edit(s,[...copy(r.draft),{letter:r.tiles[index],tile:index}]);
  }
  function setText(s,text) {
    if(!active(s)||typeof text!=='string')return false;
    text=normalize(text);if(text.length>length(question(s))||!/^[가-힣ㄱ-ㅎㅏ-ㅣ\u1100-\u11ff]*$/u.test(text))return false;
    const r=current(s),used=new Set(),items=[...text].map(letter=>{
      const tile=r.tiles.findIndex((c,i)=>c===letter&&!used.has(i));if(tile>=0)used.add(tile);
      return {letter,tile:tile>=0?tile:null};
    });
    if(text===draft(s))return false;return edit(s,items);
  }
  function erase(s,index) {
    if(!active(s))return false;const r=current(s);index=index??r.draft.length-1;
    if(!Number.isInteger(index)||index<0||index>=r.draft.length)return false;
    return edit(s,r.draft.filter((_,i)=>i!==index).map(x=>({...x})));
  }
  function undo(s) {if(!active(s)||!current(s).history.length)return false;current(s).draft=current(s).history.pop();return true;}
  function accepted(q,text) {return q.answers.some(a=>normalize(a)===normalize(text));}
  function submit(s) {
    if(!active(s))return 'inactive';const r=current(s),q=question(s),text=draft(s);
    if(text.length!==length(q)||!/^[가-힣]+$/u.test(text))return 'incomplete';
    if(accepted(q,text)){r.status='correct';r.answer=text;s.started=true;return 'correct';}
    if(r.attempts.includes(text))return 'repeated';
    if(r.attempts.length>=2000)return 'wrong';
    r.attempts.push(text);s.started=true;return 'wrong';
  }
  function hint(s) {if(!active(s)||current(s).hints>=2)return false;current(s).hints++;s.started=true;return true;}
  function hintText(s) {
    const r=current(s),q=question(s);if(!r||!q)return '';
    return r.hints===0?'':r.hints===1?q.hint:`${q.hint} ${q.answers.length>1?'한 가지 정답은':'첫 글자는'} ‘${q.answers[0][0]}’${q.answers.length>1?'으로 시작해요.':'예요.'}`;
  }
  function reveal(s) {if(!active(s))return false;current(s).status='revealed';s.started=true;return true;}
  function next(s) {if(isDone(s)||current(s).status==='playing')return false;s.index++;return true;}
  function score(s) {return {correct:s.rounds.filter(r=>r.status==='correct').length,revealed:s.rounds.filter(r=>r.status==='revealed').length,
    hints:s.rounds.reduce((n,r)=>n+r.hints,0),mistakes:s.rounds.reduce((n,r)=>n+r.attempts.length,0),seconds:Math.floor(s.elapsed)};}
  function validDate(d) {return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;}
  function frameOK(frame,r,q) {
    if(!Array.isArray(frame)||frame.length>length(q))return false;const used=new Set();
    return frame.every(x=>{
      if(!x||typeof x.letter!=='string'||x.letter.length!==1||!/^[가-힣ㄱ-ㅎㅏ-ㅣ\u1100-\u11ff]$/u.test(x.letter))return false;
      if(x.tile===null)return true;
      if(!Number.isInteger(x.tile)||x.tile<0||x.tile>=r.tiles.length||used.has(x.tile)||r.tiles[x.tile]!==x.letter)return false;
      used.add(x.tile);return true;
    });
  }
  function tilesOK(tiles,q) {
    if(!Array.isArray(tiles)||tiles.length!==required(q).length+4)return false;
    const rest=tiles.slice();for(const c of required(q)){const i=rest.indexOf(c);if(i<0)return false;rest.splice(i,1);}
    return new Set(rest).size===4&&rest.every(c=>DISTRACTORS.includes(c)&&!required(q).includes(c));
  }
  function isValid(s) {
    try {
      if(!s||s.version!==1||s.bankVersion!==W.version||!Object.hasOwn(DIFFICULTIES,s.difficulty)||(s.daily!==null&&(!validDate(s.daily)||s.difficulty!==DAILY_DIFFICULTY))
        ||!Number.isInteger(s.index)||s.index<0||s.index>COUNT||typeof s.started!=='boolean'||!Number.isFinite(s.elapsed)||s.elapsed<0
        ||!Array.isArray(s.rounds)||s.rounds.length!==COUNT||new Set(s.rounds.map(r=>r.id)).size!==COUNT)return false;
      return s.rounds.every((r,i)=>{
        const q=byId.get(r.id);if(!q||length(q)!==DIFFICULTIES[s.difficulty].length||!tilesOK(r.tiles,q)||!frameOK(r.draft,r,q)
          ||!Array.isArray(r.history)||r.history.length>HISTORY_LIMIT||!r.history.every(f=>frameOK(f,r,q))||!Array.isArray(r.attempts)||r.attempts.length>2000
          ||new Set(r.attempts).size!==r.attempts.length||r.attempts.some(t=>typeof t!=='string'||t.length!==length(q)||!/^[가-힣]+$/u.test(t)||accepted(q,t))
          ||!Number.isInteger(r.hints)||r.hints<0||r.hints>2||!['playing','correct','revealed'].includes(r.status)||typeof r.answer!=='string')return false;
        if(r.status==='correct'&&(!accepted(q,r.answer)||draft({rounds:[r],index:0})!==r.answer))return false;
        if(r.status!=='correct'&&r.answer!=='')return false;
        if(i<s.index&&r.status==='playing')return false;
        if(i>s.index&&(r.status!=='playing'||r.draft.length||r.history.length||r.attempts.length||r.hints))return false;
        if(!s.started&&(r.draft.length||r.history.length||r.attempts.length||r.hints||r.status!=='playing'))return false;
        return true;
      });
    }catch{return false;}
  }
  function shareText(s) {
    const r=score(s),title=s.daily?`${s.daily} 오늘의 도전`:DIFFICULTIES[s.difficulty].label;
    return `[매일게임 초성 퀴즈] ${title}\n직접 맞힘 ${r.correct}/${COUNT} · 힌트 ${r.hints}회 · 정답 보기 ${r.revealed}문제\n${s.rounds.map(x=>x.status==='correct'?'●':'○').join(' ')}\n같이 낱말을 맞혀 보세요!`;
  }
  return {DIFFICULTIES,COUNT,DAILY_DIFFICULTY,HISTORY_LIMIT,normalize,initials,length,required,create,current,question,draft,isDone,addTile,setText,erase,undo,submit,hint,hintText,reveal,next,score,isValid,shareText,accepted};
})();
if(typeof module!=='undefined')module.exports=InitialQuiz;
