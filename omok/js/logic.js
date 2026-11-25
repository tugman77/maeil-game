// 오목 규칙과 컴퓨터. 13×13 판, 나는 흑(먼저), 컴퓨터는 백. 가로·세로·대각선으로 5개 이상 이으면 승리(금수 없음).
// 보통·어려움은 위협 기반 탐색과 연속 4 강제 승리 증명을 사용한다.
// 같은 점수끼리는 저장 가능한 난수(state.rng)로 고르므로, 오늘의 도전은 같은 수를 두면 같은 결과가 나온다.
const Omok = (() => {
  const Common = typeof MaeilGame !== 'undefined' ? MaeilGame : require('../../common/core.js');
  const SIZE = 13;
  const CELLS = SIZE * SIZE;
  const BLACK = 1; // 나
  const WHITE = 2; // 컴퓨터
  const DIFFICULTIES = {
    easy: { label: '쉬움', undo: 3, note: '컴퓨터가 가끔 실수해요 · 무르기 3번' },
    medium: { label: '보통', undo: 1, note: '막을 곳은 잘 막아요 · 무르기 1번' },
    hard: { label: '어려움', undo: 0, note: '연속 공격과 응수를 살펴요 · 무르기 없음' },
  };
  const DAILY_DIFFICULTY = 'medium';
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const at = (x, y) => y * SIZE + x;
  const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

  function create(difficulty = 'medium', { daily = null, seedText = null } = {}) {
    if (!has(DIFFICULTIES, difficulty)) throw new Error(`알 수 없는 난이도: ${difficulty}`);
    const state = {
      version: 1, difficulty, daily,
      board: new Array(CELLS).fill(0),
      opening: [], moves: [], // opening: 오늘의 도전에서 미리 놓인 돌 [칸, 색]
      undoLeft: DIFFICULTIES[difficulty].undo,
      over: false, winner: 0, line: null, elapsed: 0,
      rng: Common.randomState(seedText || (daily ? `maeil-omok:${daily}` : `omok:${Date.now()}:${Math.random()}`)),
    };
    // 오늘의 도전: 가운데 근처에 흑·백 한 개씩 놓고 시작(날마다 다른 첫 모양)
    if (daily) {
      const c = Math.floor(SIZE / 2);
      const pick = () => c - 1 + Math.floor(Common.nextRandom(state) * 3);
      const black = at(pick(), pick());
      let white = black;
      while (white === black) white = at(pick(), pick());
      state.board[black] = BLACK;
      state.board[white] = WHITE;
      state.opening = [[black, BLACK], [white, WHITE]];
    }
    return state;
  }

  // idx를 지나는 방향 (dx,dy)의 같은 색 연속 수와 양 끝이 비었는지
  function runAt(board, idx, color, dx, dy) {
    const x0 = idx % SIZE;
    const y0 = Math.floor(idx / SIZE);
    let count = 1;
    let open = 0;
    const cells = [idx];
    for (const sign of [1, -1]) {
      let x = x0 + dx * sign;
      let y = y0 + dy * sign;
      while (inside(x, y) && board[at(x, y)] === color) {
        cells.push(at(x, y));
        count++;
        x += dx * sign;
        y += dy * sign;
      }
      if (inside(x, y) && board[at(x, y)] === 0) open++;
    }
    return { count, open, cells };
  }

  // idx에 놓인 돌로 5개 이상 이어졌으면 그 칸들
  function winLine(board, idx) {
    const color = board[idx];
    if (!color) return null;
    for (const [dx, dy] of DIRS) {
      const run = runAt(board, idx, color, dx, dy);
      if (run.count >= 5) return run.cells.sort((a, b) => a - b);
    }
    return null;
  }

  function place(state, idx, color) {
    delete state.outcomeText;
    state.board[idx] = color;
    state.moves.push(idx);
    const line = winLine(state.board, idx);
    if (line) {
      state.over = true;
      state.winner = color;
      state.line = line;
    } else if (!canMakeFive(state.board)) {
      state.over = true;
      state.winner = 0; state.reason='draw'; // 빈 점이 남아도 누구도 다섯을 만들 수 없음
    }
  }

  // 내 차례: 흑을 둔다. 둘 수 없으면 false
  function play(state, idx) {
    if (state.over || !Number.isInteger(idx) || idx < 0 || idx >= CELLS || state.board[idx] !== 0) return false;
    if (state.moves.length % 2 !== 0) return false; // 컴퓨터 차례
    place(state, idx, BLACK);
    return true;
  }

  // ---------- 컴퓨터 ----------
  // 한 방향 모양 점수: 이어진 수와 열린 끝 수
  function shape(count, open) {
    if (count >= 5) return 100000;
    if (open === 0) return 0;
    if (count === 4) return open === 2 ? 12000 : 1500;
    if (count === 3) return open === 2 ? 1200 : 120;
    if (count === 2) return open === 2 ? 100 : 12;
    return open === 2 ? 4 : 1;
  }

  // 빈칸 idx에 color를 둔다고 할 때의 점수(네 방향 합). 열린 4·열린 3이 겹치면 더 높게.
  function cellScore(board, idx, color) {
    board[idx] = color;
    let total = 0;
    let strong = 0;
    for (const [dx, dy] of DIRS) {
      const { count, open } = runAt(board, idx, color, dx, dy);
      const s = shape(count, open);
      if (s >= 1200) strong++;
      total += s;
    }
    board[idx] = 0;
    if (strong >= 2 && total < 100000) total += 8000; // 쌍삼·사삼: 막기 어려운 수
    return total;
  }

  // 돌 근처(2칸 안)의 빈칸만 후보로 본다. 판이 비었으면 가운데.
  function candidates(board) {
    const list = [];
    for (let i = 0; i < CELLS; i++) {
      if (board[i] !== 0) continue;
      const x = i % SIZE;
      const y = Math.floor(i / SIZE);
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (inside(x + dx, y + dy) && board[at(x + dx, y + dy)] !== 0) { near = true; break; }
        }
      }
      if (near) list.push(i);
    }
    return list.length ? list : [at(Math.floor(SIZE / 2), Math.floor(SIZE / 2))];
  }

  function ranked(board, me, defenseWeight) {
    const foe = me === WHITE ? BLACK : WHITE;
    return candidates(board).map((idx) => {
      const attack = cellScore(board, idx, me);
      const defense = cellScore(board, idx, foe);
      return { idx, attack, defense, score: attack * 1.1 + defense * defenseWeight };
    }).sort((a, b) => b.score - a.score || a.idx - b.idx);
  }

  // 같은 점수 묶음에서 난수로 하나
  function pickTop(state, list, spread = 0) {
    const best = list[0].score;
    const pool = list.filter((c) => c.score >= best * (1 - spread) - 1e-9);
    return pool[Math.floor(Common.nextRandom(state) * pool.length)].idx;
  }

  function chooseMove(state) {
    const board = state.board;
    const list = ranked(board, WHITE, 1);
    const win = list.find((c) => c.attack >= 100000);
    if (win) return win.idx;
    const mustBlock = list.find((c) => c.defense >= 100000);
    const level = state.difficulty;

    if (level === 'easy') {
      // 쉬움: 상대 5목은 대개 막지만(85%), 그 밖에는 상위 몇 수 중 아무거나 → 빈틈이 생긴다
      if (mustBlock && Common.nextRandom(state) < 0.85) return mustBlock.idx;
      const pool = list.slice(0, 4);
      return pool[Math.floor(Common.nextRandom(state) * pool.length)].idx;
    }
    return analyze(state).move;
  }
  // Every length-five window, including broken fours and edge patterns.
  const WINDOWS=[];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)for(const [dx,dy] of DIRS){
    if(inside(x+dx*4,y+dy*4))WINDOWS.push(Array.from({length:5},(_,k)=>at(x+dx*k,y+dy*k)));
  }
  function winningMoves(board,color){
    const out=new Set();
    for(const line of WINDOWS){let own=0,empty=-1,blocked=false;
      for(const i of line){if(board[i]===color)own++;else if(board[i]){blocked=true;break;}else empty=i;}
      if(!blocked&&own===4)out.add(empty);
    }
    return [...out];
  }
  function canMakeFive(board){
    return WINDOWS.some(line=>!line.some(i=>board[i]===BLACK)||!line.some(i=>board[i]===WHITE));
  }
  // Proof by forcing fours. At a defending node all legal escapes are covered:
  // a counter-win, the unique required block, or two distinct winning endpoints.
  // With no forcing four we return unknown, never a heuristic claim of victory.
  function prove(board,attacker,turn,depth,context){
    context.visit();
    const defender=3-attacker,own=winningMoves(board,turn);
    if(own.length)return turn===attacker?{move:own[0],plies:1,steps:[{idx:own[0],color:attacker}]}:null;
    const threats=winningMoves(board,3-turn);
    if(turn!==attacker){
      if(threats.length>=2)return {plies:2,steps:[{idx:threats[0],color:defender},{idx:threats[1],color:attacker}]};
      if(threats.length!==1||depth<1)return null;
      const i=threats[0];board[i]=defender;
      try{const r=prove(board,attacker,attacker,depth-1,context);return r?{plies:r.plies+1,steps:[{idx:i,color:defender},...r.steps]}:null;}finally{board[i]=0;}
    }
    if(depth<1||threats.length>=2)return null;
    const forcing=new Set();
    if(threats.length)forcing.add(threats[0]);
    else for(const line of WINDOWS){let own=0,blocked=false;const empty=[];
      for(const i of line){if(board[i]===attacker)own++;else if(board[i]){blocked=true;break;}else empty.push(i);}
      if(!blocked&&own===3)empty.forEach(i=>forcing.add(i));
    }
    const moves=[...forcing].sort((a,b)=>cellScore(board,b,attacker)-cellScore(board,a,attacker)||a-b);
    for(const i of moves){board[i]=attacker;
      try{
        if(!winningMoves(board,attacker).length)continue;
        const r=prove(board,attacker,defender,depth-1,context);if(r)return {move:i,plies:r.plies+1,steps:[{idx:i,color:attacker},...r.steps]};
      }finally{board[i]=0;}
    }
    return null;
  }
  function analyze(state,options={}){
    if(state.over)return {move:-1,forced:null};
    const board=state.board.slice(),turn=state.moves.length%2?WHITE:BLACK;
    const started=Date.now(),deadline=started+(options.timeMs??(state.difficulty==='hard'?1550:1000));
    const STOP=Symbol('budget');let nodes=0;
    const budget=options.nodes??12000;
    const context={visit(){if(++nodes>budget||Date.now()>=deadline)throw STOP;}};
    const report={move:-1,forced:null,depth:0};
    const ownWins=winningMoves(board,turn),foeWins=winningMoves(board,3-turn);
    let list=ranked(board,turn,1.15);
    report.move=ownWins[0]??foeWins[0]??list[0]?.idx??-1;
    try{
      // Reserve most of the budget for regular search; VCF itself is bounded.
      const proofContext={visit(){context.visit();if(nodes>Math.min(2200,budget/3))throw STOP;}};
      for(const color of [turn,3-turn]){
        const proof=prove(board,color,turn,options.proofDepth??12,proofContext);
        if(proof){report.forced={winner:color,plies:proof.plies};report.explanation=explainThreat(board,color,proof.steps);if(color===turn)report.move=proof.move;break;}
      }
    }catch(e){if(e!==STOP)throw e;}
    if(ownWins.length||foeWins.length||report.forced?.winner===turn)return {...report,nodes,elapsedMs:Date.now()-started};
    if(options.assessOnly)return {...report,move:-1,nodes,elapsedMs:Date.now()-started};
    function ordered(color,width){
      const wins=winningMoves(board,color);if(wins.length)return wins;
      const blocks=winningMoves(board,3-color);if(blocks.length)return blocks;
      return ranked(board,color,1.15).slice(0,width).map(c=>c.idx);
    }
    function evaluate(color){
      const a=ranked(board,color,0).slice(0,2),b=ranked(board,3-color,0).slice(0,2);
      return (a[0]?.attack||0)+(a[1]?.attack||0)*.25-(b[0]?.attack||0)*1.15-(b[1]?.attack||0)*.3;
    }
    function search(color,depth,alpha,beta,ply){
      context.visit();const wins=winningMoves(board,color);if(wins.length)return 1000000-ply;
      const threats=winningMoves(board,3-color);if(threats.length>=2)return -1000000+ply+1;
      if(depth<=0)return evaluate(color);
      let value=-Infinity;
      for(const i of ordered(color,depth>=2?8:6)){
        board[i]=color;let score;
        try{score=-search(3-color,depth-1,-beta,-alpha,ply+1);}finally{board[i]=0;}
        value=Math.max(value,score);alpha=Math.max(alpha,score);if(alpha>=beta)break;
      }
      return value===-Infinity?0:value;
    }
    const maxDepth=options.depth??(state.difficulty==='hard'?4:2);
    // Include both ends of open threes and fork-making moves through threat ranking.
    const roots=list.slice(0,state.difficulty==='hard'?12:10).map(c=>c.idx);
    for(let depth=1;depth<=maxDepth;depth++){
      let best=report.move,bestValue=-Infinity,alpha=-Infinity;
      try{
        roots.sort((a,b)=>(b===report.move)-(a===report.move));
        for(const i of roots){
          context.visit();board[i]=turn;let value;
          try{
            // Explicitly reject moves that allow an opponent forcing-four proof.
            const r=depth>=2?prove(board,3-turn,3-turn,8,context):null;
            value=r?-1000000+r.plies:-search(3-turn,depth-1,-Infinity,-alpha,1);
          }finally{board[i]=0;}
          if(value>bestValue){bestValue=value;best=i;}alpha=Math.max(alpha,value);
        }
        report.move=best;report.depth=depth;
      }catch(e){if(e!==STOP)throw e;break;}
    }
    return {...report,nodes:Math.min(nodes,budget),elapsedMs:Date.now()-started};
  }
  function resign(state,loser){
    if(state.over||![BLACK,WHITE].includes(loser))return false;
    state.over=true;state.winner=3-loser;state.reason='resign';state.resigned=loser;state.line=null;return true;
  }
  function decision(state,report){
    if(state.over||!report?.forced)return null;
    return {winner:report.forced.winner,text:`${report.forced.winner===BLACK?'흑':'백'} 승리가 확정됐어요`,explanation:report.explanation};
  }

  // Presentation data comes from the proven line; it does not affect move choice.
  function threatMarks(board,color){
    const blocks=winningMoves(board,color),stones=new Set();
    for(const line of WINDOWS){
      if(line.filter(i=>board[i]===color).length===4&&line.some(i=>blocks.includes(i)))
        line.filter(i=>board[i]===color).forEach(i=>stones.add(i));
    }
    return {stones:[...stones],blocks};
  }
  function openFour(board,color){
    for(let i=0;i<CELLS;i++)if(board[i]===color)for(const [dx,dy] of DIRS){
      const r=runAt(board,i,color,dx,dy);
      if(r.count===4&&r.open===2)return r.cells;
    }
    return null;
  }
  function explainThreat(board,color,steps=[]){
    const marks=threatMarks(board,color),stones=new Set(marks.stones),next=[];
    let type=marks.blocks.length>=2?(openFour(board,color)?'open-four':'double-four'):'vcf';
    // A four-three has one immediate block and an existing three that can
    // become an open four after that block. Check the actual proven reply.
    const trial=board.slice();
    if(marks.blocks.length===1&&steps[0]?.color===3-color){
      trial[steps[0].idx]=3-color;
      const reply=steps[1];
      if(reply?.color===color){
        trial[reply.idx]=color;
        const four=openFour(trial,color);
        if(four&&four.includes(reply.idx)&&four.filter(i=>board[i]===color).length===3){
          type='four-three';next.push(reply.idx);four.filter(i=>board[i]===color).forEach(i=>stones.add(i));
        }
      }
    }
    // Include the existing stones used by later forcing fours, without
    // presenting future stones as if they had already been played.
    trial.splice(0,CELLS,...board);
    for(const step of steps){
      trial[step.idx]=step.color;
      threatMarks(trial,color).stones.filter(i=>board[i]===color).forEach(i=>stones.add(i));
    }
    if(type==='vcf'&&steps[0]?.color===color)next.push(steps[0].idx);
    if(steps.length===1)type='finish-five';
    const descriptions={
      'open-four':'열린 4: 양쪽 끝이 비어 있어 한쪽을 막아도 다른 쪽으로 다섯이 됩니다',
      'double-four':'4-4: 서로 다른 두 곳을 막아야 해요. 한 곳을 막아도 다른 곳에서 다섯이 됩니다',
      'four-three':'4-3: 4를 막으면 3이 열린 4가 됩니다',
      'vcf':'연속 4: 4를 계속 만들며 이기는 수순이 있습니다 — 수순 보기',
      'finish-five':'다섯 완성: 표시한 빈칸에 두면 다섯이 됩니다',
    };
    return {type,color,stones:[...stones],blocks:marks.blocks,next,steps,text:descriptions[type]};
  }
  function explainWin(state){
    const line=state.line||winLine(state.board,lastMove(state));
    if(!line?.length)return null;
    const direction=line[0]%SIZE===line[1]%SIZE?'세로':Math.floor(line[0]/SIZE)===Math.floor(line[1]/SIZE)?'가로':'대각선';
    const color=state.board[line[0]],who=color===BLACK?'흑':'백(컴퓨터)';
    return {line,direction,text:`${who}이 ${direction}${direction==='대각선'?'으로':'로'} ${line.length===5?'다섯 개':line.length+'개'}를 이었어요 — ${color===BLACK?'내 승리':'내 패배'}`};
  }
  function replayBoard(state,count){
    const board=new Array(CELLS).fill(0);
    state.opening.forEach(([i,color])=>board[i]=color);
    state.moves.slice(0,count).forEach((i,n)=>board[i]=n%2?WHITE:BLACK);
    return board;
  }
  function restore(state){
    if(!isValid(state))return null;
    const s=JSON.parse(JSON.stringify(state));
    if(!s.over){
      const i=s.moves.at(-1),line=i===undefined?null:winLine(s.board,i);
      if(line){s.over=true;s.winner=s.board[i];s.line=line;}
      else if(!canMakeFive(s.board)){s.over=true;s.winner=0;s.reason='draw';}
    }
    return s;
  }

  // 컴퓨터 차례: 백을 두고 둔 칸을 돌려준다
  function aiMove(state) {
    if (state.over || state.moves.length % 2 !== 1) return -1;
    return commitAI(state,chooseMove(state));
  }

  function commitAI(state,idx){
    if(state.over||state.moves.length%2!==1||!Number.isInteger(idx)||idx<0||idx>=CELLS||state.board[idx])return -1;
    place(state,idx,WHITE);return idx;
  }

  // 무르기: 컴퓨터 수와 내 마지막 수를 함께 되돌린다
  function canUndo(state) {
    return !state.over && state.undoLeft > 0 && state.moves.length >= 2 && state.moves.length % 2 === 0;
  }
  function undo(state) {
    if (!canUndo(state)) return false;
    for (let k = 0; k < 2; k++) state.board[state.moves.pop()] = 0;
    delete state.outcomeText;
    state.undoLeft--;
    return true;
  }

  const lastMove = (state) => (state.moves.length ? state.moves[state.moves.length - 1] : -1);
  const playerMoves = (state) => Math.ceil(state.moves.length / 2);

  function isValid(state) {
    try {
    if (state?.continueDecided!==undefined&&typeof state.continueDecided!=='boolean')return false;
    if (!state || typeof state !== 'object' || state.version !== 1 || !has(DIFFICULTIES, state.difficulty)) return false;
    if (!Array.isArray(state.board) || state.board.length !== CELLS || !state.board.every((v) => v === 0 || v === 1 || v === 2)) return false;
    if (!Array.isArray(state.moves) || !Array.isArray(state.opening) || !Number.isInteger(state.rng)) return false;
    if (!Number.isInteger(state.undoLeft) || state.undoLeft < 0 || !Number.isFinite(state.elapsed)) return false;
    // 판과 수순이 맞는지 다시 그려 본다
    const board = new Array(CELLS).fill(0);
    for (const [idx, color] of state.opening) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS || board[idx] || (color !== BLACK && color !== WHITE)) return false;
      board[idx] = color;
    }
    for (let i = 0; i < state.moves.length; i++) {
      const idx = state.moves[i];
      if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS || board[idx]) return false;
      board[idx] = i % 2 === 0 ? BLACK : WHITE;
    }
    if(state.resigned!==undefined&&(![BLACK,WHITE].includes(state.resigned)||!state.over||state.winner!==3-state.resigned||state.reason!=='resign'))return false;
    return board.every((v, i) => v === state.board[i]);
    } catch { return false; }
  }

  return { SIZE, CELLS, BLACK, WHITE, DIFFICULTIES, DAILY_DIFFICULTY, create, play, aiMove, commitAI, analyze, winningMoves, canMakeFive, prove, resign, decision, restore, chooseMove, winLine, canUndo, undo, lastMove, playerMoves, isValid, cellScore, threatMarks, explainWin, replayBoard };
})();

if (typeof module !== 'undefined') module.exports = Omok;
