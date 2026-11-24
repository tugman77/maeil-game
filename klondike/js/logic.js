// 한 장 뽑기 클론다이크. 뽑은 카드 순서·뒤집힘·덱 재순환까지 저장한다.
const KlondikeGame = (() => {
  const M=typeof MaeilGame!=='undefined'?MaeilGame:require('../../common/core.js');
  const DEALS=typeof KlondikeDeals!=='undefined'?KlondikeDeals:require('./deals.js');
  const SUITS=['♠','♥','♣','♦'],SUIT_NAMES=['스페이드','하트','클로버','다이아몬드'];
  const DIFFICULTIES={easy:{label:'쉬움',detail:'한 장 뽑기 · 비교적 짧은 검증 수순'},medium:{label:'보통',detail:'한 장 뽑기 · 풀이 검증 판'},hard:{label:'어려움',detail:'한 장 뽑기 · 더 긴 검증 수순'}};
  const DAILY_DIFFICULTY='medium',HISTORY_LIMIT=200;
  const suit=c=>Math.floor(c/13),rank=c=>c%13+1,red=c=>suit(c)%2===1;
  const rankText=c=>({1:'A',11:'J',12:'Q',13:'K'})[rank(c)]||String(rank(c));
  const cardText=c=>`${rankText(c)}${SUITS[suit(c)]}`,cardName=c=>`${SUIT_NAMES[suit(c)]} ${rankText(c)}`;
  const fits=(c,p)=>rank(p)===rank(c)+1&&red(c)!==red(p);
  const runOK=cards=>cards.length>0&&cards.slice(1).every((c,i)=>fits(c,cards[i]));
  const snapshot=s=>({columns:s.columns.map(c=>c.slice()),hidden:s.hidden.slice(),stock:s.stock.slice(),waste:s.waste.slice(),foundations:s.foundations.slice()});
  const positionKey=s=>`${s.foundations.join(',')}|${s.stock.join(',')}|${s.waste.join(',')}|${s.columns.map((c,i)=>s.hidden[i]+':'+c.join(',')).join(';')}`;
  const foundationCount=s=>s.foundations.reduce((a,n)=>a+n,0),isDone=s=>foundationCount(s)===52;
  function sourceCards(s,from){
    if(!from||!Number.isInteger(from.index))return null;
    if(from.type==='waste')return from.index===0&&s.waste.length?[s.waste.at(-1)]:null;
    if(from.type==='foundation'&&from.index>=0&&from.index<4)return s.foundations[from.index]?[from.index*13+s.foundations[from.index]-1]:null;
    if(from.type!=='column'||from.index<0||from.index>=7||!Number.isInteger(from.start))return null;
    const c=s.columns[from.index];if(from.start<s.hidden[from.index]||from.start>=c.length)return null;
    const cards=c.slice(from.start);return runOK(cards)?cards:null;
  }
  function canMove(s,from,to){
    if(!to||!Number.isInteger(to.index)||from?.type===to.type&&from.index===to.index)return false;
    const cards=sourceCards(s,from);if(!cards)return false;
    if(to.type==='foundation')return from.type!=='foundation'&&cards.length===1&&to.index===suit(cards[0])&&rank(cards[0])===s.foundations[to.index]+1;
    if(to.type!=='column'||to.index<0||to.index>=7)return false;
    const target=s.columns[to.index];return target.length?fits(cards[0],target.at(-1)):rank(cards[0])===13;
  }
  function apply(s,from,to){
    if(!canMove(s,from,to))return false;const cards=sourceCards(s,from);
    if(from.type==='waste')s.waste.pop();
    else if(from.type==='foundation')s.foundations[from.index]--;
    else {s.columns[from.index].splice(from.start);if(s.hidden[from.index]&&s.hidden[from.index]===s.columns[from.index].length)s.hidden[from.index]--;}
    if(to.type==='foundation')s.foundations[to.index]++;else s.columns[to.index].push(...cards);return true;
  }
  function applyAction(s,a){
    if(a.type==='draw'){
      if(s.stock.length){s.waste.push(s.stock.pop());return true;}
      if(s.waste.length){s.stock=s.waste.slice().reverse();s.waste=[];return true;}return false;
    }
    return apply(s,a.from,a.to);
  }
  function remember(s){s.history.push({...snapshot(s),moves:s.moves,passes:s.passes});if(s.history.length>HISTORY_LIMIT)s.history.shift();}
  function move(s,from,to){if(!canMove(s,from,to))return false;remember(s);apply(s,from,to);s.moves++;s.started=true;return true;}
  function draw(s){if(!s.stock.length&&!s.waste.length)return false;remember(s);if(!s.stock.length)s.passes++;applyAction(s,{type:'draw'});s.moves++;s.started=true;return true;}
  function undo(s){const previous=s.history.pop();if(!previous)return false;Object.assign(s,previous);s.undoUsed++;return true;}
  function safeForFoundation(s,c){const r=rank(c),i=suit(c);return r===s.foundations[i]+1&&(r<=2||s.foundations.every((n,j)=>j===i||n>=r-(i%2!==j%2?1:2)));}
  function safeMove(s){
    if(s.waste.length&&safeForFoundation(s,s.waste.at(-1)))return{from:{type:'waste',index:0},to:{type:'foundation',index:suit(s.waste.at(-1))}};
    for(let i=0;i<7;i++){const c=s.columns[i].at(-1);if(c!==undefined&&safeForFoundation(s,c))return{from:{type:'column',index:i,start:s.columns[i].length-1},to:{type:'foundation',index:suit(c)}};}return null;
  }
  function autoFoundation(s){let a=safeMove(s),count=0;if(!a)return 0;remember(s);while(a){apply(s,a.from,a.to);count++;a=safeMove(s);}s.moves+=count;s.started=true;return count;}
  function legalMoves(s,{foundationBack=true}={}){
    const sources=[];s.columns.forEach((c,index)=>{for(let start=s.hidden[index];start<c.length;start++)sources.push({type:'column',index,start});});
    if(s.waste.length)sources.push({type:'waste',index:0});
    if(foundationBack)s.foundations.forEach((n,index)=>{if(n)sources.push({type:'foundation',index});});
    const result=[],empty=s.columns.findIndex(c=>!c.length);
    for(const from of sources){const cards=sourceCards(s,from);if(!cards)continue;
      const f={type:'foundation',index:suit(cards[0])};if(canMove(s,from,f))result.push({from,to:f});
      for(let index=0;index<7;index++){
        if(!s.columns[index].length&&(index!==empty||from.type==='column'&&from.start===0))continue;
        const to={type:'column',index};if(canMove(s,from,to))result.push({from,to});
      }
    }
    if(s.stock.length||s.waste.length)result.push({type:'draw'});return result;
  }
  function rawDeal(seed){const random=M.createSeededRandom(`klondike:raw:${seed}`),deck=M.shuffle(Array.from({length:52},(_,i)=>i),random);return{columns:Array.from({length:7},(_,i)=>deck.splice(0,i+1)),hidden:[0,1,2,3,4,5,6],stock:deck,waste:[],foundations:[0,0,0,0]};}
  function verifySolution(p,actions){const s=snapshot(p);for(const a of actions)if(!a||!applyAction(s,a))return false;return isDone(s);}
  function decode(a){if(a[0]===-1)return{type:'draw'};const loc=(n,start)=>n<7?{type:'column',index:n,...(start===undefined?{}:{start})}:n===7?{type:'waste',index:0}:{type:'foundation',index:n-8};return{from:loc(a[0],a[2]),to:loc(a[1])};}
  function create(difficulty,{daily=null,dealNumber,random=Math.random}={}){
    if(!Object.hasOwn(DIFFICULTIES,difficulty))throw Error('알 수 없는 난이도');
    if(dealNumber===undefined)dealNumber=Math.floor(random()*0x100000000);
    if(!Number.isInteger(dealNumber)||dealNumber<0||dealNumber>0xffffffff)throw Error('잘못된 판 번호');
    const r=M.createSeededRandom(`klondike:deal:${difficulty}:${dealNumber}`),group=DEALS.filter(d=>d.difficulty===difficulty);
    if(!group.length)throw Error('검증된 클론다이크 판이 없습니다.');
    const day=daily?Math.floor(Date.parse(daily+'T00:00:00Z')/86400000):null;
    const entry=group[day===null?Math.floor(r()*group.length):day%group.length],raw=rawDeal(entry.seed);
    let black=M.shuffle([0,2],r),reds=M.shuffle([1,3],r);if(r()<.5)[black,reds]=[reds,black];const suits=[black[0],reds[0],black[1],reds[1]];
    const transform=c=>suits[suit(c)]*13+rank(c)-1,initial={columns:raw.columns.map(c=>c.map(transform)),hidden:raw.hidden.slice(),stock:raw.stock.map(transform),waste:[],foundations:[0,0,0,0]};
    const loc=p=>({...p,index:p.type==='foundation'?suits[p.index]:p.index});
    const solution=entry.solution.map(decode).map(a=>a.type==='draw'?a:{from:loc(a.from),to:loc(a.to)});
    if(!verifySolution(initial,solution))throw Error('클론다이크 풀이 검증 실패');
    return{version:1,difficulty,daily,dealNumber,baseDeal:entry.seed,initial,solution,...snapshot(initial),history:[],moves:0,passes:0,hintsUsed:0,undoUsed:0,elapsed:0,started:false};
  }
  function solutionMap(s){const map=new Map(),p=snapshot(s.initial);for(const a of s.solution){map.set(positionKey(p),a);if(!applyAction(p,a))return new Map();}return map;}
  function hint(s,map){const a=map?.get(positionKey(s));if(a&&(a.type==='draw'||canMove(s,a.from,a.to)))return a;const safe=safeMove(s);if(safe)return safe;
    const actions=legalMoves(s),previous=s.history.length?positionKey(s.history.at(-1)):null;let best=null,bestScore=-Infinity;
    for(const m of actions){const next=snapshot(s);applyAction(next,m);if(positionKey(next)===previous)continue;
      let score=foundationCount(next)*20-next.hidden.reduce((a,n)=>a+n,0)*14+(m.type==='draw'?-2:0);
      if(m.from?.type==='foundation')score-=4;if(score>bestScore){best=m;bestScore=score;}}
    return best||actions[0]||null;
  }
  function validPosition(s){
    if(!s||!Array.isArray(s.columns)||s.columns.length!==7||!Array.isArray(s.hidden)||s.hidden.length!==7||!Array.isArray(s.stock)||!Array.isArray(s.waste)||!Array.isArray(s.foundations)||s.foundations.length!==4)return false;
    if(!s.foundations.every(n=>Number.isInteger(n)&&n>=0&&n<=13))return false;const seen=new Set();s.foundations.forEach((n,j)=>{for(let i=0;i<n;i++)seen.add(j*13+i);});
    const accept=c=>{if(!Number.isInteger(c)||c<0||c>=52||seen.has(c))return false;seen.add(c);return true;};
    for(let i=0;i<7;i++){const c=s.columns[i],h=s.hidden[i];if(!Array.isArray(c)||c.length>52||!Number.isInteger(h)||h<0||h>Math.max(0,c.length-1)||!c.every(accept)||(c.length&&!runOK(c.slice(h))))return false;}
    return s.stock.length<=52&&s.waste.length<=52&&s.stock.every(accept)&&s.waste.every(accept)&&seen.size===52;
  }
  function isValid(s){
    if(!s||s.version!==1||!Object.hasOwn(DIFFICULTIES,s.difficulty)||!validPosition(s)||!validPosition(s.initial))return false;
    if(s.daily!==null&&(typeof s.daily!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.daily)||s.difficulty!==DAILY_DIFFICULTY))return false;
    if(!Number.isInteger(s.dealNumber)||s.dealNumber<0||s.dealNumber>0xffffffff||!Number.isInteger(s.baseDeal))return false;
    if(s.initial.columns.some((c,i)=>c.length!==i+1||s.initial.hidden[i]!==i)||s.initial.stock.length!==24||s.initial.waste.length||s.initial.foundations.some(Boolean))return false;
    if(!Array.isArray(s.solution)||s.solution.length>1000||!verifySolution(s.initial,s.solution))return false;
    if(!Array.isArray(s.history)||s.history.length>HISTORY_LIMIT||!s.history.every(h=>validPosition(h)&&Number.isSafeInteger(h.moves)&&h.moves>=0&&Number.isSafeInteger(h.passes)&&h.passes>=0))return false;
    return['moves','passes','hintsUsed','undoUsed'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)&&Number.isFinite(s.elapsed)&&s.elapsed>=0&&typeof s.started==='boolean';
  }
  return{SUITS,SUIT_NAMES,DIFFICULTIES,DAILY_DIFFICULTY,HISTORY_LIMIT,suit,rank,red,rankText,cardText,cardName,fits,runOK,snapshot,positionKey,foundationCount,isDone,sourceCards,canMove,apply,applyAction,move,draw,undo,safeForFoundation,safeMove,autoFoundation,legalMoves,rawDeal,verifySolution,decode,create,solutionMap,hint,validPosition,isValid};
})();
if(typeof module!=='undefined')module.exports=KlondikeGame;
