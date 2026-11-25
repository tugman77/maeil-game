// Iterative deepening, capture quiescence, move ordering and bounded transpositions.
const JanggiAI = (() => {
  const G=typeof Janggi!=='undefined'?Janggi:require('./logic.js');
  const STOP=Symbol('budget'),MATE=1000000;
  function evaluate(p){
    let score=0;
    for(let i=0;i<90;i++){
      const v=p.board[i];if(!v)continue;const s=G.side(v),t=G.type(v),y=Math.floor(i/9),x=i%9,progress=s===G.CHO?9-y:y;
      let value=G.VALUES[t]*100;
      if(t===G.P)value+=progress*7+(4-Math.abs(4-x))*4;
      if(t===G.H||t===G.E)value+=(4-Math.abs(4-x))*9+Math.min(progress,6)*3;
      if(t===G.R||t===G.C)value+=Math.min(progress,6)*4;
      if(t===G.A)value+=i%9===4?10:0;
      score+=s*value;
    }
    for(const s of [G.CHO,G.HAN]){
      const k=p.board.indexOf(s*G.K);if(k<0)continue;
      const x=k%9,y=Math.floor(k/9);
      // Guards and enemy pressure around the palace, without expensive legal mobility.
      for(let i=0;i<90;i++)if(p.board[i]){
        const d=Math.abs(i%9-x)+Math.abs(Math.floor(i/9)-y);
        if(G.side(p.board[i])===s&&G.type(p.board[i])===G.A&&d<=2)score+=s*24;
        if(G.side(p.board[i])===-s&&d<=4)score-=s*(5-d)*([G.R,G.C,G.H].includes(G.type(p.board[i]))?14:7);
      }
    }
    return score*p.turn;
  }
  function analyze(state,options={}){
    if(state.over)return {move:null,forced:null};
    if(state.kind==='puzzle')return {move:G.matingMoves(state)[0]||G.legalMoves(state)[0]||null,forced:null};
    const cfg=G.DIFFICULTIES[state.difficulty]||G.DIFFICULTIES.medium;
    const maxDepth=Math.max(1,Math.min(9,options.depth??cfg.depth)),budget=Math.max(64,options.nodes??cfg.nodes);
    const started=Date.now(),deadline=started+(options.timeMs??cfg.timeMs??150),table=new Map(),killers=[];
    let nodes=0,completedDepth=0,score=0,forced=null;
    const root=G.legalActions(state);if(!root.length)return {move:null,forced:null};
    function order(p,actions,preferred,ply){
      const value=a=>G.sameAction(a,preferred)?1e9:a.pass?-1e6:(G.VALUES[G.type(p.board[a.to])]||0)*10000-(G.VALUES[G.type(p.board[a.from])]||0)*10+(killers[ply]?.some(k=>G.sameAction(k,a))?5000:0);
      return actions.slice().sort((a,b)=>value(b)-value(a)||(a.from??99)-(b.from??99)||(a.to??99)-(b.to??99));
    }
    let best=order(state,root,null,0)[0],bestLine=[];
    function visit(){if(++nodes>budget||Date.now()>=deadline)throw STOP;}
    function search(p,depth,alpha,beta,ply,qleft=state.difficulty==='easy'?0:4,line={}){
      visit();
      if(p.over){const v=p.reason==='mate'?MATE:MATE-10000;return p.winner===p.turn?v-ply:-v+ply;}
      const checked=G.inCheck(p.board,p.turn);
      let actions=G.legalActions(p);
      if(!actions.length)return checked?-MATE+ply:evaluate(p);
      // Full history in the key prevents repetition/bikjang/200-move aliasing.
      const key=depth>0?`${ply}/${p.passes}/${p.capturedAny}/${p.bikjang}/${p.ply}/${p.keys.join(';')}`:null;
      const cached=key&&table.get(key);
      if(cached&&cached.depth>=depth){if(cached.flag==='exact'){line.steps=cached.steps;return cached.score;}if(cached.flag==='lower')alpha=Math.max(alpha,cached.score);else beta=Math.min(beta,cached.score);if(alpha>=beta){line.steps=cached.steps;return cached.score;}}
      const originalAlpha=alpha;
      let value=-Infinity;
      if(depth<=0){
        if(qleft<=0)return evaluate(p)-(checked?90:0);
        if(!checked){value=evaluate(p);if(value>=beta)return value;alpha=Math.max(alpha,value);actions=actions.filter(a=>!a.pass&&p.board[a.to]);if(!actions.length)return value;}
      }
      let choice=null,steps=[];
      for(const action of order(p,actions,cached?.move,ply)){
        const child={};const v=-search(G.advance(p,action),depth-1,-beta,-alpha,ply+1,depth<=0?qleft-1:qleft,child);
        if(v>value){value=v;choice=action;steps=[action,...(child.steps||[])];}alpha=Math.max(alpha,v);
        if(alpha>=beta){if(!action.pass&&!p.board[action.to])killers[ply]=[action,...(killers[ply]||[])].slice(0,2);break;}
      }
      if(key&&table.size<40000)table.set(key,{depth,score:value,move:choice,steps,flag:value<=originalAlpha?'upper':value>=beta?'lower':'exact'});
      line.steps=steps;return value;
    }
    for(let depth=1;depth<=maxDepth;depth++){
      let choice=best,value=-Infinity,alpha=-Infinity,line=[];
      try{
        for(const action of order(state,root,best,0)){
          const child={};const v=-search(G.advance(state,action),depth-1,-Infinity,-alpha,1,undefined,child);
          if(v>value){value=v;choice=action;line=[action,...(child.steps||[])];}alpha=Math.max(alpha,v);
        }
        best=choice;bestLine=line;score=value;completedDepth=depth;
        // Only completed iterations and mate terminals can produce a proof.
        if(Math.abs(score)>MATE-1000){forced={winner:score>0?state.turn:-state.turn,plies:MATE-Math.abs(score)};break;}
      }catch(e){if(e!==STOP)throw e;break;}
    }
    const proof=forced&&G.proofPositions(state,bestLine,forced.winner)?{steps:bestLine}:null;
    const result={move:best,score,forced,proof,nodes:Math.min(nodes,budget),depth:completedDepth,elapsedMs:Date.now()-started};
    if(options.diagnostics)Object.assign(options.diagnostics,result);
    return result;
  }
  const chooseMove=(s,o={})=>analyze(s,o).move;
  return {chooseMove,analyze,evaluate};
})();
if(typeof module!=='undefined')module.exports=JanggiAI;
