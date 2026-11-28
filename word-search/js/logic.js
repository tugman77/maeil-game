const WordSearch = (() => {
  const M = typeof module !== 'undefined' && module.exports ? require('../../common/core.js') : MaeilGame;
  const THEMES = [
    ['우리 밥상', '김치 된장 두부 나물 잡채 비빔밥 불고기 미역국'],
    ['과일 가게', '사과 포도 자두 수박 참외 복숭아 바나나 감귤'],
    ['채소 가게', '배추 당근 오이 호박 감자 고구마 시금치 양파'],
    ['꽃이 피면', '장미 국화 매화 수선화 진달래 개나리 민들레 무궁화'],
    ['숲속 산책', '나무 풀잎 솔방울 다람쥐 도토리 오솔길 산새 버섯'],
    ['하늘과 날씨', '햇살 구름 바람 이슬 소나기 무지개 눈송이 안개'],
    ['즐거운 나들이', '여행 등산 소풍 바닷가 기차 버스 사진 배낭'],
    ['정겨운 물건', '연필 공책 안경 시계 달력 우산 손수건 지갑'],
    ['우리 동네', '시장 공원 도서관 우체국 정류장 약국 학교 골목'],
    ['바다 풍경', '파도 모래 조개 등대 갈매기 물고기 돛단배 해변'],
    ['함께하는 취미', '독서 낚시 바둑 장기 뜨개질 그림 노래 운동'],
    ['따뜻한 마음', '사랑 우정 감사 행복 미소 응원 배려 기쁨'],
  ].map(([name, text]) => ({ name, words: text.split(' ') }));
  const DIFFICULTIES = {
    easy: { label: '쉬움', size: 5, count: 4, detail: '5×5 · 4단어 · 오른쪽·아래쪽', directions: [[0,1],[1,0]] },
    normal: { label: '보통', size: 6, count: 6, detail: '6×6 · 6단어 · 대각선도 찾아요', directions: [[0,1],[1,0],[1,1]] },
    hard: { label: '어려움', size: 7, count: 8, detail: '7×7 · 8단어 · 거꾸로도 찾아요', directions: [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]] },
  };
  const DIRECTIONS = DIFFICULTIES.hard.directions;
  function shuffle(items, random) {
    const a = items.slice();
    for (let i=a.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  function path(size, start, end) {
    if (![start,end].every(i=>Number.isInteger(i)&&i>=0&&i<size*size) || start===end) return [];
    const r=Math.floor(start/size), c=start%size, dr=Math.floor(end/size)-r, dc=end%size-c;
    if (dr && dc && Math.abs(dr)!==Math.abs(dc)) return [];
    return Array.from({length:Math.max(Math.abs(dr),Math.abs(dc))+1},(_,i)=>(r+i*Math.sign(dr))*size+c+i*Math.sign(dc));
  }
  function occurrences(grid, word, size) {
    const found=[];
    for(let start=0;start<grid.length;start++)for(const [dr,dc] of DIRECTIONS){
      const r=Math.floor(start/size),c=start%size,er=r+dr*(word.length-1),ec=c+dc*(word.length-1);
      if(er<0||er>=size||ec<0||ec>=size)continue;
      const cells=path(size,start,er*size+ec);
      if(cells.map(i=>grid[i]).join('')===word)found.push(cells);
    }
    return found;
  }
  function puzzle(difficulty, seed) {
    const config=DIFFICULTIES[difficulty], random=M.createSeededRandom(`word-search:v1:${difficulty}:${seed}`);
    const theme=THEMES[Math.floor(random()*THEMES.length)], words=shuffle(theme.words,random).slice(0,config.count),size=config.size;
    const alphabet=[...new Set(THEMES.flatMap(t=>t.words).join('')+'가나다라마바사아자차카타파하')];
    for(let attempt=0;attempt<500;attempt++){
      const grid=Array(size*size).fill(''), placements=Array(words.length);
      for(const {word,index} of words.map((word,index)=>({word,index})).sort((a,b)=>b.word.length-a.word.length)){
        const candidates=[];
        for(let start=0;start<grid.length;start++)for(const [dr,dc] of config.directions){
          const r=Math.floor(start/size),c=start%size,er=r+dr*(word.length-1),ec=c+dc*(word.length-1);
          if(er<0||er>=size||ec<0||ec>=size)continue;
          const cells=path(size,start,er*size+ec);
          if(cells.every((n,i)=>!grid[n]||grid[n]===word[i]))candidates.push(cells);
        }
        if(!candidates.length)break;
        const cells=candidates[Math.floor(random()*candidates.length)];
        cells.forEach((n,i)=>{grid[n]=word[i];}); placements[index]=cells;
      }
      if(placements.filter(Boolean).length!==words.length)continue;
      for(let fill=0;fill<20;fill++){
        const board=grid.map(c=>c||alphabet[Math.floor(random()*alphabet.length)]);
        if(words.every(w=>occurrences(board,w,size).length===1))return {size,theme:theme.name,words,grid:board,placements};
      }
    }
    throw Error('단어판을 만들지 못했어요. 다시 시작해 주세요.');
  }
  function create(difficulty='normal', options={}) {
    if(!DIFFICULTIES[difficulty])difficulty='normal';
    const daily=options.daily||null,seed=daily?`daily:${daily}`:String(options.seed??`${Date.now()}:${Math.random()}`);
    return {version:1,difficulty,daily,seed,...puzzle(difficulty,seed),found:[],hinted:[],hints:0};
  }
  const isDone=s=>s.found.length===s.words.length;
  function select(s,start,end){
    if(isDone(s))return 'finished';
    const cells=path(s.size,start,end), text=cells.map(i=>s.grid[i]).join('');
    const index=s.words.findIndex(w=>w===text||[...w].reverse().join('')===text);
    if(index<0)return 'miss';
    if(s.found.includes(index))return 'repeated';
    // The path must be the one actual occurrence, including selection in reverse order.
    const expected=s.placements[index];
    if(cells.join(',')!==expected.join(',')&&cells.slice().reverse().join(',')!==expected.join(','))return 'miss';
    s.found.push(index);return 'found';
  }
  function undo(s){if(!s.found.length||isDone(s))return false;s.found.pop();return true;}
  function hint(s){
    if(isDone(s))return -1;
    const i=s.words.findIndex((_,i)=>!s.found.includes(i)&&!s.hinted.includes(i));
    if(i>=0){s.hinted.push(i);s.hints++;}return i;
  }
  function isValid(s){
    try{
      if(!s||s.version!==1||!DIFFICULTIES[s.difficulty]||typeof s.seed!=='string'||s.seed.length>150)return false;
      if(s.daily!==null&&!(typeof s.daily==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.daily)&&new Date(s.daily+'T00:00:00Z').toISOString().slice(0,10)===s.daily&&s.seed===`daily:${s.daily}`&&s.difficulty==='normal'))return false;
      for(const key of ['found','hinted'])if(!Array.isArray(s[key])||s[key].length>DIFFICULTIES[s.difficulty].count||new Set(s[key]).size!==s[key].length||!s[key].every(i=>Number.isInteger(i)&&i>=0&&i<DIFFICULTIES[s.difficulty].count))return false;
      if(s.hints!==s.hinted.length)return false;
      const expected=puzzle(s.difficulty,s.seed);
      return Object.keys(expected).every(k=>JSON.stringify(s[k])===JSON.stringify(expected[k]));
    }catch{return false;}
  }
  function shareText(s){return `한글 단어 찾기 — 매일게임\n${s.daily?`${s.daily} 오늘의 도전`:DIFFICULTIES[s.difficulty].label} · ${s.theme}\n${s.found.length}/${s.words.length}단어 찾음 · 힌트 ${s.hints}회`;}
  return {THEMES,DIFFICULTIES,create,path,occurrences,select,undo,hint,isDone,isValid,shareText};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WordSearch;
