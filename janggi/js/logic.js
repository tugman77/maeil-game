// 장기 행마·궁 안전과 매일게임 친선 점수제. 화면·탐색과 독립적으로 검사한다.
const Janggi = (() => {
  const M=typeof MaeilGame!=='undefined'?MaeilGame:require('../../common/core.js');
  const COLS=9,ROWS=10,CELLS=90,CHO=1,HAN=-1,K=1,A=2,R=3,C=4,H=5,E=6,P=7;
  const VALUES={1:0,2:3,3:13,4:7,5:5,6:3,7:2},NAMES={1:'궁',2:'사',3:'차',4:'포',5:'마',6:'상',7:'졸'};
  const DIFFICULTIES={easy:{label:'쉬움',depth:1,nodes:500,note:'한 수를 살펴요 · 무르기 제한 없음'},medium:{label:'보통',depth:5,nodes:50000,timeMs:850,note:'응수를 함께 살펴요 · 무르기 제한 없음'},hard:{label:'어려움',depth:7,nodes:160000,timeMs:2200,note:'여러 수를 탐색해요 · 전문 기사 수준은 아니에요'}};
  const FORMATIONS=[[H,E,E,H],[E,H,H,E],[H,E,H,E],[E,H,E,H]];
  const PALACE_LINES=[[3,13,23],[5,13,21],[66,76,86],[68,76,84]];
  const inside=(x,y)=>x>=0&&x<9&&y>=0&&y<10;
  const at=(x,y)=>y*9+x;
  const side=v=>Math.sign(v),type=v=>Math.abs(v);
  const palace=(i,s)=>i%9>=3&&i%9<=5&&(s===CHO?i>=63&&i<=89:i>=0&&i<27);
  const coord=i=>`${String.fromCharCode(65+i%9)}${Math.floor(i/9)+1}`;
  const sameAction=(a,b)=>Boolean(a&&b&&a.from===b.from&&a.to===b.to&&Boolean(a.pass)===Boolean(b.pass));
  function initialBoard(formation=0){
    if(!Number.isInteger(formation)||formation<0||formation>3)throw Error('잘못된 포진');
    const b=Array(90).fill(0);
    for(const s of [CHO,HAN]){
      const y=s===CHO?9:0,f=s===CHO?FORMATIONS[formation]:FORMATIONS[0],row=[R,f[0],f[1],A,0,A,f[2],f[3],R];
      row.forEach((v,x)=>{b[at(x,y)]=v?v*s:0;});b[at(4,s===CHO?8:1)]=s*K;
      for(const x of [1,7])b[at(x,s===CHO?7:2)]=s*C;
      for(const x of [0,2,4,6,8])b[at(x,s===CHO?6:3)]=s*P;
    }
    return b;
  }
  function lineFrom(i,dx,dy){const out=[];let x=i%9+dx,y=Math.floor(i/9)+dy;while(inside(x,y)){out.push(at(x,y));x+=dx;y+=dy;}return out;}
  function diagonals(i){
    const out=[];for(const line of PALACE_LINES){const n=line.indexOf(i);if(n<0)continue;for(const d of [-1,1]){const ray=[];for(let j=n+d;j>=0&&j<3;j+=d)ray.push(line[j]);if(ray.length)out.push(ray);}}
    return out;
  }
  function pseudoMoves(board,from){
    if(!Number.isInteger(from)||from<0||from>=90||!board[from])return [];
    const s=side(board[from]),t=type(board[from]),x=from%9,y=Math.floor(from/9),result=[];
    const add=(nx,ny)=>{if(inside(nx,ny)&&side(board[at(nx,ny)])!==s)result.push(at(nx,ny));};
    if(t===K||t===A){
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(inside(x+dx,y+dy)&&palace(at(x+dx,y+dy),s))add(x+dx,y+dy);
      for(const ray of diagonals(from))if(palace(ray[0],s)&&side(board[ray[0]])!==s)result.push(ray[0]);
    }else if(t===R||t===C){
      const rays=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>lineFrom(from,dx,dy)).concat(diagonals(from));
      for(const ray of rays){let screen=false;for(const to of ray){const v=board[to];
        if(t===R){if(side(v)!==s)result.push(to);if(v)break;}
        else if(!screen){if(v){if(type(v)===C)break;screen=true;}}
        else {if(!v)result.push(to);else {if(side(v)!==s&&type(v)!==C)result.push(to);break;}}
      }}
    }else if(t===H||t===E){
      const a=t===H?2:3,b=t===H?1:2;
      for(const [dx,dy] of [[a,b],[a,-b],[-a,b],[-a,-b],[b,a],[b,-a],[-b,a],[-b,-a]]){
        const nx=x+dx,ny=y+dy;if(!inside(nx,ny))continue;
        const sx=Math.sign(dx),sy=Math.sign(dy),horizontal=Math.abs(dx)>Math.abs(dy);
        const leg1=horizontal?at(x+sx,y):at(x,y+sy);
        if(board[leg1])continue;
        if(t===E){const leg2=horizontal?at(x+2*sx,y+sy):at(x+sx,y+2*sy);if(board[leg2])continue;}
        add(nx,ny);
      }
    }else if(t===P){
      add(x+1,y);add(x-1,y);add(x,y-s);
      if(palace(from,-s))for(const ray of diagonals(from)){const to=ray[0];if(Math.floor(to/9)===y-s&&side(board[to])!==s)result.push(to);}
    }
    return result;
  }
  function inCheck(board,s){const king=board.indexOf(s*K);if(king<0)return true;for(let i=0;i<90;i++)if(side(board[i])===-s&&pseudoMoves(board,i).includes(king))return true;return false;}
  function facing(board){const a=board.indexOf(K),b=board.indexOf(-K);if(a<0||b<0||a%9!==b%9)return false;for(let i=Math.min(a,b)+9;i<Math.max(a,b);i+=9)if(board[i])return false;return true;}
  function points(board){const result={cho:0,han:1.5};for(const v of board)if(v)result[v>0?'cho':'han']+=VALUES[type(v)];return result;}
  const key=p=>`${p.turn}:${p.board.join(',')}`;
  function position(board,capturedAny=false){const p={board:board.slice(),turn:CHO,ply:0,passes:0,bikjang:facing(board),capturedAny,over:false,winner:0,reason:'',last:null,keys:[],leadSide:0,leadCount:0};p.keys=[key(p)];return adjudicate(p);}
  function legalMoves(p){
    if(p.over)return [];const result=[];
    for(let from=0;from<90;from++)if(side(p.board[from])===p.turn)for(const to of pseudoMoves(p.board,from)){
      if(type(p.board[to])===K)continue;const b=p.board.slice();b[to]=b[from];b[from]=0;
      if(!inCheck(b,p.turn)&&(p.capturedAny||!facing(b)))result.push({from,to});
    }
    return result;
  }
  const canPass=p=>!p.over&&!inCheck(p.board,p.turn);
  const legalActions=p=>{const moves=legalMoves(p);if(canPass(p))moves.push({pass:true});return moves;};
  const isLegal=(p,a)=>Boolean(a&&!p.over&&(a.pass?canPass(p):legalMoves(p).some(m=>sameAction(m,a))));
  function decidePoints(p,reason){const v=points(p.board);p.over=true;p.winner=v.cho>v.han?CHO:HAN;p.reason=reason;}
  // Every entry point uses the same mate-first adjudication, including replay/undo.
  function adjudicate(p){
    if(!p.over&&inCheck(p.board,p.turn)&&!legalMoves(p).length){p.over=true;p.winner=-p.turn;p.reason='mate';}
    return p;
  }
  function advance(p,action){
    const n={...p,board:p.board.slice(),keys:p.keys.slice(),last:action.pass?{pass:true}:{from:action.from,to:action.to}},mover=p.turn;
    if(action.pass)n.passes++;else{n.capturedAny=p.capturedAny||Boolean(n.board[action.to]);n.board[action.to]=n.board[action.from];n.board[action.from]=0;n.ply++;n.passes=0;}
    n.turn=-mover;n.bikjang=facing(n.board);n.keys.push(key(n));
    const score=points(n.board),lead=score.cho-score.han,leader=Math.abs(lead)>=20?Math.sign(lead):0;
    n.leadSide=leader;n.leadCount=leader?(p.leadSide===leader?(p.leadCount||0)+1:1):0;
    adjudicate(n);
    if(!n.over&&n.passes>=2)decidePoints(n,'passes');
    else if(!n.over&&n.keys.filter(k=>k===n.keys.at(-1)).length>=4){n.over=true;n.winner=-mover;n.reason='repetition';}
    if(!n.over&&p.bikjang&&n.bikjang)decidePoints(n,'bikjang');
    if(!n.over&&n.ply>=200)decidePoints(n,'limit');
    return n;
  }
  function puzzleBoard(day){
    const random=M.dailyRandom('janggi',day),b=Array(90).fill(0),rookX=[0,1,2,3,5,6,7,8][Math.floor(random()*8)];
    b[4]=-K;b[at(rookX,1)]=R;b[22]=P;
    b[[66,67,68,75,76,77,84,85,86][Math.floor(random()*9)]]=K;
    for(const x of [0,2,6,8])if(random()<.5)b[at(x,3)]=-P;
    for(const x of [0,8])if(random()<.5)b[at(x,6)]=P;
    return b;
  }
  function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;}
  function create(difficulty='medium',{daily=null,formation=0}={}){
    if(!Object.hasOwn(DIFFICULTIES,difficulty)||(daily!==null&&!validDate(daily)))throw Error('잘못된 게임 설정');
    if(daily){difficulty='medium';formation=0;}
    const initial=daily?puzzleBoard(daily):initialBoard(formation),p=position(initial,Boolean(daily));
    return {...p,version:1,kind:daily?'puzzle':'match',difficulty,daily,formation,initial,actions:[],undoMarks:[],elapsed:0,hintsUsed:0,undoUsed:0,puzzleAttempts:0,puzzleAttempted:false};
  }
  function assignPosition(s,p){for(const k of ['board','turn','ply','passes','bikjang','capturedAny','over','winner','reason','last','keys','leadSide','leadCount'])s[k]=p[k];}
  function move(s,action){
    if(s.kind==='puzzle'&&s.puzzleAttempted)return false;
    if(!isLegal(s,action))return false;
    const a=action.pass?{pass:true}:{from:action.from,to:action.to};
    if(s.turn===CHO){s.undoMarks.push(s.actions.length);if(s.undoMarks.length>100)s.undoMarks.shift();}
    delete s.outcomeText;
    s.actions.push(a);assignPosition(s,advance(s,a));
    if(s.kind==='puzzle'){s.puzzleAttempts++;s.puzzleAttempted=true;}
    return true;
  }
  function replay(initial,actions,puzzle=false,validate=true){
    let p=position(initial,puzzle);const marks=[];
    for(let i=0;i<actions.length;i++){
      const a=actions[i];if(p.over||!a)return null;
      if(a.resign){if(i!==actions.length-1||puzzle||![CHO,HAN].includes(a.side??CHO))return null;p={...p,over:true,winner:-(a.side??CHO),reason:'resign'};continue;}
      if(validate&&!isLegal(p,a))return null;if(p.turn===CHO)marks.push(i);p=advance(p,a,validate);
    }
    return {p,marks:marks.slice(-100)};
  }
  const canUndo=s=>Boolean(s.undoMarks.length);
  function undo(s){
    if(!canUndo(s))return false;const target=s.undoMarks.at(-1),actions=s.actions.slice(0,target),r=replay(s.initial,actions,s.kind==='puzzle',false);
    if(!r)return false;delete s.outcomeText;assignPosition(s,r.p);s.actions=actions;s.undoMarks=r.marks;s.puzzleAttempted=false;s.undoUsed++;return true;
  }
  function resign(s,loser=CHO){if(s.over||s.kind!=='match'||![CHO,HAN].includes(loser))return false;s.actions.push({resign:true,side:loser});s.over=true;s.winner=-loser;s.reason='resign';return true;}
  function decision(s,report){
    if(s.over||s.kind!=='match')return null;
    if(report?.forced&&[CHO,HAN].includes(report.forced.winner)&&report.forced.plies>0)return {winner:report.forced.winner,text:`${Math.ceil(report.forced.plies/2)}수 안에 외통이 확정됐어요`,reason:'mate'};
    if(s.leadCount>=6)return {winner:s.leadSide,text:`${s.leadSide===CHO?'초':'한'}가 크게 유리해요 · 기물 20점 이상 차이가 6차례 이어졌어요`,reason:'material'};
    return null;
  }
  function restore(s){
    try{
      const n=JSON.parse(JSON.stringify(s));
      // Old undo saves could miss a terminal mate. Only repair adjudication fields;
      // the board and complete action history still have to pass validation.
      adjudicate(n);
      if(!isValid(n))return null;
      const r=replay(n.initial,n.actions,n.kind==='puzzle');n.leadSide=r.p.leadSide;n.leadCount=r.p.leadCount;
      return n;
    }catch{return null;}
  }
  function validBoard(b){
    return Array.isArray(b)&&b.length===90&&b.every((v,i)=>Number.isInteger(v)&&Math.abs(v)<=7&&(!(type(v)===K||type(v)===A)||palace(i,side(v))))
      &&b.filter(v=>v===K).length===1&&b.filter(v=>v===-K).length===1;
  }
  function isValid(s){
    try{
      if(!s||(s.continueDecided!==undefined&&typeof s.continueDecided!=='boolean')||s.version!==1||!Object.hasOwn(DIFFICULTIES,s.difficulty)||!['match','puzzle'].includes(s.kind)||!validBoard(s.board)||!validBoard(s.initial)
        ||(s.daily!==null&&!validDate(s.daily))||Boolean(s.daily)!==(s.kind==='puzzle')||(s.daily&&s.difficulty!=='medium')
        ||!Number.isInteger(s.formation)||s.formation<0||s.formation>3||!Array.isArray(s.actions)||s.actions.length>402||!Array.isArray(s.undoMarks)
        ||!['elapsed','hintsUsed','undoUsed','puzzleAttempts'].every(k=>Number.isFinite(s[k])&&s[k]>=0)||!['hintsUsed','undoUsed','puzzleAttempts'].every(k=>Number.isSafeInteger(s[k]))||typeof s.puzzleAttempted!=='boolean')return false;
      const initial=s.daily?puzzleBoard(s.daily):initialBoard(s.formation);if(JSON.stringify(initial)!==JSON.stringify(s.initial))return false;
      if(s.kind==='puzzle'&&(s.actions.length>1||s.puzzleAttempted!==Boolean(s.actions.length)||s.puzzleAttempts<s.actions.length))return false;
      if(s.kind==='match'&&(s.puzzleAttempted||s.puzzleAttempts))return false;
      const r=replay(s.initial,s.actions,s.kind==='puzzle');if(!r||JSON.stringify(r.marks)!==JSON.stringify(s.undoMarks))return false;
      return ['board','turn','ply','passes','bikjang','capturedAny','over','winner','reason','last','keys'].every(k=>JSON.stringify(r.p[k])===JSON.stringify(s[k]));
    }catch{return false;}
  }
  const reasonText={mate:'외통수',bikjang:'빅장 점수 판정',passes:'서로 한 수 쉼 · 점수 판정',repetition:'같은 판 네 번째 반복',limit:'200수 · 점수 판정',resign:'기권'};
  function matingMoves(p){return legalMoves(p).filter(a=>{const n=advance(p,a);return n.over&&n.reason==='mate'&&n.winner===p.turn;});}
  const sideName=s=>s===CHO?'초':'한';
  const pieceTitle=v=>type(v)===P?(v>0?'졸':'병'):NAMES[type(v)];
  function attackers(board,target,s){
    return board.flatMap((v,i)=>side(v)===s&&pseudoMoves(board,i).includes(target)?[i]:[]);
  }
  // Follow the actual movement path: cannon screens and horse/elephant legs stay visible.
  function attackPath(board,from,to){
    const x=from%9,y=Math.floor(from/9),dx=to%9-x,dy=Math.floor(to/9)-y,sx=Math.sign(dx),sy=Math.sign(dy),t=type(board[from]);
    if(t===H||t===E){
      const horizontal=Math.abs(dx)>Math.abs(dy),leg=horizontal?at(x+sx,y):at(x,y+sy);
      return t===H?[from,leg,to]:[from,leg,horizontal?at(x+2*sx,y+sy):at(x+sx,y+2*sy),to];
    }
    const n=Math.max(Math.abs(dx),Math.abs(dy));
    return Array.from({length:n+1},(_,i)=>at(x+sx*i,y+sy*i));
  }
  function mateExplanation(p,s=p.turn){
    const king=p.board.indexOf(s*K);if(king<0)return null;
    const sources=attackers(p.board,king,-s);
    const empty=Array(90).fill(0);empty[king]=s*K;
    const escapes=pseudoMoves(empty,king).map(to=>{
      if(side(p.board[to])===s)return {to,reason:'own',piece:p.board[to],attackers:[]};
      const b=p.board.slice();b[king]=0;b[to]=s*K;
      const guards=attackers(b,to,-s);
      return {to,reason:guards.length?'attack':(!p.capturedAny&&facing(b)?'facing':'safe'),attackers:guards};
    });
    const mate=Boolean(sources.length&&!legalMoves({...p,turn:s,over:false}).length);
    const names=[...new Set(sources.map(i=>pieceTitle(p.board[i])))].join('·');
    return {king,side:s,attackers:sources,paths:sources.map(from=>attackPath(p.board,from,king)),escapes,mate,
      text:mate?`${sideName(-s)}의 ${names}가 궁을 장군했고, 궁이 피할 곳이 없어요 — 외통으로 ${sideName(-s)} 승리`:'',
      detail:mate?'장군을 막거나 공격한 말을 잡아 궁을 지킬 수도 없어요.':''};
  }
  function historyAt(s,count){
    if(!Number.isInteger(count)||count<0||count>s.actions.length)return null;
    return replay(s.initial,s.actions.slice(0,count),s.kind==='puzzle')?.p||null;
  }
  function proofPositions(p,steps,winner){
    if(!Array.isArray(steps)||!steps.length||steps.length>32)return null;
    const positions=[p];let n=p;
    for(const a of steps){if(!isLegal(n,a))return null;n=advance(n,a);positions.push(n);}
    return n.over&&n.reason==='mate'&&n.winner===winner?positions:null;
  }
  function resultExplanation(s){
    const scores=points(s.board),difference=Math.abs(scores.cho-scores.han);
    const scoreText=`남은 점수 · 초 ${scores.cho}점 / 한 ${scores.han}점 · ${difference}점 차이 (한 덤 1.5점 포함)`;
    const mate=s.reason==='mate'?mateExplanation(s):null;
    const reasons={bikjang:'두 궁이 마주본 빅장을 응수 뒤에도 풀지 않아 점수로 판정했어요.',passes:'양쪽이 연속으로 한 수씩 쉬어 남은 말 점수로 판정했어요.',limit:'기물 이동 200수가 되어 남은 말 점수로 판정했어요.',repetition:`차례까지 같은 판을 네 번째 만든 ${sideName(-s.winner)}의 반복 패배예요.`,resign:s.outcomeText||`${sideName(-s.winner)}가 기권했어요.`};
    return {mate,text:mate?.text||reasons[s.reason]||'',detail:mate?.detail||'',scores,scoreText};
  }
  return {sideName,pieceTitle,attackers,attackPath,mateExplanation,historyAt,proofPositions,resultExplanation,COLS,ROWS,CELLS,CHO,HAN,K,A,R,C,H,E,P,VALUES,NAMES,DIFFICULTIES,FORMATIONS,PALACE_LINES,coord,side,type,palace,initialBoard,pseudoMoves,inCheck,facing,points,position,legalMoves,legalActions,canPass,isLegal,advance,adjudicate,restore,decision,create,move,canUndo,undo,resign,isValid,validBoard,sameAction,matingMoves,reasonText};
})();
if(typeof module!=='undefined')module.exports=Janggi;
