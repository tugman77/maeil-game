const HanjaGame = (() => {
  const M = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const B = typeof HanjaBank !== 'undefined' ? HanjaBank : require('./bank.js');
  const ID='hanja', COUNT=5, LANGS=B.languages;
  const MODES={read:'훈음 익히기',write:'한자 떠올리기',listen:'소리 듣기'};
  const LEVELS={easy:{label:'1~3과',detail:'8급 한자 1~15자'},medium:{label:'4~7과',detail:'8급 한자 16~35자'},hard:{label:'8~10과',detail:'8급 한자 36~50자'}};
  const shuffle=(a,rng)=>M.shuffle([...a],rng);
  function create({lang='ko',mode='read',level='easy',daily=null,random=Math.random}={}) {
    if(!LANGS[lang]||!MODES[mode]||!LEVELS[level]) throw Error('학습 설정을 확인해 주세요.');
    if(daily!==null){if(!/^\d{4}-\d{2}-\d{2}$/.test(daily))throw Error('날짜가 올바르지 않습니다.');random=M.dailyRandom(`${ID}-${mode}`,daily);level='easy';}
    const range={easy:[0,15],medium:[15,35],hard:[35,50]}[level];
    const pool=shuffle(B.items.ko.slice(...range),random), picked=pool.slice(0,COUNT);
    const rounds=picked.map(item=>{
      const expected=mode==='write'?item.char:(mode==='listen'?item.reading:item.hunum);
      const distractors=shuffle(B.items.ko.filter(x=>x.id!==item.id).map(x=>mode==='write'?x.char:(mode==='listen'?x.reading:x.hunum)).filter(x=>x!==expected),random).slice(0,3);
      return {item:item.id,options:shuffle([expected,...distractors],random),attempts:[],status:'playing',stroke:0,guide:'none'};
    });
    return {version:1,bankVersion:B.version,lang,mode,level,daily,index:0,correct:0,rounds};
  }
  const current=s=>s?.rounds?.[s.index]||null;
  const itemFor=(s,r=current(s))=>B.items.ko.find(x=>x.id===r?.item);
  const done=s=>s?.index===COUNT;
  const expectedFor=(s,item)=>s.mode==='write'?item.char:(s.mode==='listen'?item.reading:item.hunum);
  function answer(s,index){const r=current(s),item=itemFor(s,r);if(!r||!item||r.status!=='playing'||!Number.isInteger(index)||index<0||index>=r.options.length||r.attempts.includes(index))return'inactive';if(r.options[index]===expectedFor(s,item)){r.status='correct';s.correct++;return'correct';}r.attempts.push(index);if(r.attempts.length>=r.options.length-1){r.status='revealed';return'revealed';}return'wrong';}
  function reveal(s){const r=current(s);if(!r||r.status!=='playing')return false;r.status='revealed';return true;}
  function next(s){if(!current(s)||current(s).status==='playing')return false;s.index++;return true;}
  const score=s=>({correct:s.correct,revealed:s.rounds.filter(r=>r.status==='revealed').length});
  function isValid(s){try{if(!s||s.version!==1||s.bankVersion!==B.version||!LANGS[s.lang]||!MODES[s.mode]||!LEVELS[s.level]||!Array.isArray(s.rounds)||s.rounds.length!==COUNT||!Number.isInteger(s.index)||s.index<0||s.index>COUNT||!Number.isInteger(s.correct)||s.correct<0||s.correct>COUNT)return false;let correct=0;for(let i=0;i<COUNT;i++){const r=s.rounds[i],item=itemFor(s,r);if(!item||!Array.isArray(r.options)||r.options.length!==4||new Set(r.options).size!==4||!Array.isArray(r.attempts)||!['playing','correct','revealed'].includes(r.status)||r.attempts.some(x=>!Number.isInteger(x)||x<0||x>=4)||!r.options.includes(expectedFor(s,item))||r.attempts.some(x=>r.options[x]===expectedFor(s,item)))return false;if(r.status==='correct')correct++;if(i<s.index&&r.status==='playing')return false;if(i>s.index&&(r.status!=='playing'||r.attempts.length))return false;}return correct===s.correct&&(s.daily===null||/^\d{4}-\d{2}-\d{2}$/.test(s.daily));}catch{return false;}}
  function shareText(s){return `[매일게임 오늘의 한자] 한국어문회 8급 · ${MODES[s.mode]}\n맞힌 문제 ${s.correct}/${COUNT}\n오늘도 한 글자씩 익혀 보세요!`;}
  return {ID,COUNT,LANGS,MODES,LEVELS,create,current,itemFor,done,answer,reveal,next,score,isValid,shareText,expectedFor};
})();
if(typeof module!=='undefined')module.exports=HanjaGame;
