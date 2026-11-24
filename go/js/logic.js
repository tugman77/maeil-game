/* 9줄 친선 바둑: 영역 계가, 백 덤 6.5, 자충·동일 배치 반복 금지. */
(function(root,factory){const api=factory(typeof MaeilGame!=='undefined'?MaeilGame:require('../../common/core.js'));if(typeof module==='object'&&module.exports)module.exports=api;else root.GoGame=api;})(globalThis,M=>{
  'use strict';
  const N=9,BLACK=1,WHITE=-1,KOMI=6.5;
  const DIFFICULTIES={easy:{label:'쉬움',note:'잡기와 단수 위주로 두는 연습 상대',samples:0},medium:{label:'보통',note:'잡기·연결·짧은 응수를 살피는 상대',samples:4},hard:{label:'어려움',note:'더 많은 짧은 수순을 비교하는 상대',samples:12}};
  const neighbors=i=>[i%N?i-1:-1,i%N<N-1?i+1:-1,i>=N?i-N:-1,i<N*(N-1)?i+N:-1].filter(x=>x>=0);
  const NEIGHBORS=Array.from({length:81},(_,i)=>neighbors(i));
  const key=b=>b.map(v=>v+1).join('');
  function group(board,start){
    if(!board[start])return {stones:[],liberties:[]};
    const color=board[start],seen=new Set([start]),lib=new Set(),queue=[start];
    for(let j=0;j<queue.length;j++)for(const i of NEIGHBORS[queue[j]]){
      if(!board[i])lib.add(i);else if(board[i]===color&&!seen.has(i)){seen.add(i);queue.push(i);}
    }
    return {stones:queue,liberties:[...lib]};
  }
  function tryMove(p,at){
    if(!Number.isInteger(at)||at<0||at>=81)return {ok:false,error:'range'};
    if(p.board[at])return {ok:false,error:'occupied'};
    const board=p.board.slice(),taken=new Set();board[at]=p.turn;
    for(const i of NEIGHBORS[at])if(board[i]===-p.turn){const g=group(board,i);if(!g.liberties.length)g.stones.forEach(x=>taken.add(x));}
    taken.forEach(i=>{board[i]=0;});const own=group(board,at);
    if(!own.liberties.length)return {ok:false,error:'suicide'};
    if(p.keys?.includes(key(board)))return {ok:false,error:'repeat'};
    return {ok:true,board,captured:[...taken],liberties:own.liberties};
  }
  function legalMoves(p){if(p.over||p.phase!=='play')return [];const out=[];for(let i=0;i<81;i++)if(!p.board[i]&&tryMove(p,i).ok)out.push(i);return out;}
  function dailyPosition(day){
    const r=M.dailyRandom('go',day),len=1+Math.floor(r()*3),x=1+Math.floor(r()*4),y=1+Math.floor(r()*6),b=Array(81).fill(0),targets=[];
    for(let j=0;j<len;j++){const i=y*9+x+j;b[i]=WHITE;targets.push(i);}
    const libs=[...new Set(targets.flatMap(i=>NEIGHBORS[i]).filter(i=>!b[i]))],answer=libs[Math.floor(r()*libs.length)];
    libs.filter(i=>i!==answer).forEach(i=>{b[i]=BLACK;});
    const rotation=Math.floor(r()*8),map=i=>{let a=i%9,c=Math.floor(i/9);if(rotation>=4)a=8-a;for(let j=0;j<rotation%4;j++)[a,c]=[8-c,a];return c*9+a;};
    const board=Array(81).fill(0);b.forEach((v,i)=>{board[map(i)]=v;});return {board,targets:targets.map(map).sort((a,b)=>a-b)};
  }
  function create(difficulty='medium',{daily=null}={}){
    if(!Object.hasOwn(DIFFICULTIES,difficulty))difficulty='medium';
    const initial=daily?dailyPosition(daily):{board:Array(81).fill(0),targets:[]};
    return {version:1,difficulty,daily,kind:daily?'puzzle':'match',board:initial.board.slice(),targets:initial.targets,turn:BLACK,phase:'play',passes:0,ply:0,captures:{black:0,white:0},keys:[key(initial.board)],last:-1,dead:[],over:false,winner:0,reason:'',actions:[],undoMarks:[],elapsed:0,hintsUsed:0,undoUsed:0,attempts:0,attempted:false};
  }
  function score(board,dead=[]){
    const b=board.slice();dead.forEach(i=>{b[i]=0;});const ownership=Array(81).fill(0),seen=new Set();let black=0,white=0,neutral=0;
    b.forEach((v,i)=>{if(v){ownership[i]=v;v===BLACK?black++:white++;}});
    for(let i=0;i<81;i++)if(!b[i]&&!seen.has(i)){
      const region=[i],border=new Set();seen.add(i);
      for(let j=0;j<region.length;j++)for(const n of NEIGHBORS[region[j]])if(b[n])border.add(b[n]);else if(!seen.has(n)){seen.add(n);region.push(n);}
      const owner=border.size===1?[...border][0]:0;region.forEach(n=>{ownership[n]=owner;});
      if(owner===BLACK)black+=region.length;else if(owner===WHITE)white+=region.length;else neutral+=region.length;
    }
    return {black,white:white+KOMI,whiteArea:white,neutral,ownership,winner:black>white+KOMI?BLACK:WHITE,margin:Math.abs(black-white-KOMI)};
  }
  function validDead(p,dead){
    if(!Array.isArray(dead)||new Set(dead).size!==dead.length||dead.some(i=>!Number.isInteger(i)||i<0||i>=81||!p.board[i]))return false;
    const marked=new Set(dead);return dead.every(i=>group(p.board,i).stones.every(n=>marked.has(n)));
  }
  function apply(p,a){
    if(!p||p.over||!a||typeof a!=='object')return false;
    if(a.resign===true&&p.kind==='match'){p.dead=[];p.over=true;p.winner=WHITE;p.reason='resign';return true;}
    if(a.resume===true&&p.phase==='scoring'){p.phase='play';p.passes=0;p.dead=[];return true;}
    if(Array.isArray(a.score)&&p.phase==='scoring'&&validDead(p,a.score)){
      p.dead=[...a.score].sort((a,b)=>a-b);p.over=true;p.winner=score(p.board,p.dead).winner;p.reason='score';return true;
    }
    if(p.phase!=='play'||p.attempted)return false;
    if(a.pass===true&&p.kind==='match'){p.turn=-p.turn;p.passes++;p.last=-1;if(p.passes===2){p.phase='scoring';p.dead=[];}return true;}
    const result=tryMove(p,a.at);if(!result.ok)return false;
    p.board=result.board;p.keys.push(key(p.board));p.captures[p.turn===BLACK?'black':'white']+=result.captured.length;p.last=a.at;p.ply++;p.passes=0;p.turn=-p.turn;
    if(p.kind==='puzzle'){p.attempts++;p.attempted=true;if(p.targets.every(i=>!p.board[i])){p.over=true;p.winner=BLACK;p.reason='puzzle';}}
    return true;
  }
  function canonical(a){return a?.resign===true?{resign:true}:a?.resume===true?{resume:true}:Array.isArray(a?.score)?{score:[...a.score].sort((a,b)=>a-b)}:a?.pass===true?{pass:true}:{at:a?.at};}
  function move(p,a){
    const action=canonical(a),mark=p.turn===BLACK&&p.phase==='play'&&!action.resign;
    if(!apply(p,action))return false;if(mark)p.undoMarks.push(p.actions.length);p.actions.push(action);return true;
  }
  function canUndo(p){return !!p&&!p.over&&p.undoMarks.length>0;}
  function undo(p){
    if(!canUndo(p))return false;const end=p.undoMarks[p.undoMarks.length-1],fresh=create(p.difficulty,{daily:p.daily});
    for(const a of p.actions.slice(0,end))move(fresh,a);
    for(const k of ['elapsed','hintsUsed','attempts'])fresh[k]=p[k];fresh.undoUsed=p.undoUsed+1;Object.assign(p,fresh);return true;
  }
  function toggleDead(p,at){if(!p||p.phase!=='scoring'||p.over||!p.board[at])return false;const g=group(p.board,at).stones,dead=new Set(p.dead),remove=dead.has(at);g.forEach(i=>remove?dead.delete(i):dead.add(i));p.dead=[...dead].sort((a,b)=>a-b);return true;}
  function puzzleMoves(p){return legalMoves(p).filter(at=>{const t=tryMove(p,at);return p.targets.every(i=>!t.board[i]);});}
  function isValid(p){
    try{
      if(!p||p.version!==1||!Object.hasOwn(DIFFICULTIES,p.difficulty)||!(p.daily===null||typeof p.daily==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.daily)&&new Date(p.daily).toISOString().slice(0,10)===p.daily)||!Array.isArray(p.actions)||p.actions.length>5000)return false;
      for(const k of ['elapsed','hintsUsed','undoUsed','attempts'])if(!Number.isFinite(p[k])||p[k]<0||(k!=='elapsed'&&!Number.isSafeInteger(p[k])))return false;
      const f=create(p.difficulty,{daily:p.daily});for(const a of p.actions)if(JSON.stringify(a)!==JSON.stringify(canonical(a))||!move(f,a))return false;
      if(p.kind==='puzzle'){if(p.attempts<f.attempts)return false;}else if(p.attempts!==0)return false;
      if(!validDead(p,p.dead)||p.phase!=='scoring'&&p.dead.length)return false;
      for(const k of ['kind','board','targets','turn','phase','passes','ply','captures','keys','last','over','winner','reason','undoMarks','attempted'])if(JSON.stringify(p[k])!==JSON.stringify(f[k]))return false;
      if(p.over&&JSON.stringify(p.dead)!==JSON.stringify(f.dead))return false;return true;
    }catch{return false;}
  }
  const coord=i=>`${'ABCDEFGHJ'[i%9]}${9-Math.floor(i/9)}`;
  return {N,BLACK,WHITE,KOMI,DIFFICULTIES,NEIGHBORS,key,group,tryMove,legalMoves,dailyPosition,create,score,move,canUndo,undo,toggleDead,puzzleMoves,isValid,coord};
});
