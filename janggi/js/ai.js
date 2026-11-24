// 기물 가치·전진·중앙 진출 평가와 반복 심화 알파베타. 노드 한도로 기기별 결과를 같게 한다.
const JanggiAI = (() => {
  const G=typeof Janggi!=='undefined'?Janggi:require('./logic.js');
  const STOP=Symbol('node-limit'),MATE=1000000;
  function evaluate(p){
    let score=0;
    for(let i=0;i<90;i++){
      const v=p.board[i];if(!v)continue;const s=G.side(v),t=G.type(v),y=Math.floor(i/9),x=i%9,progress=s===G.CHO?9-y:y;
      let value=G.VALUES[t]*100;
      if(t===G.P)value+=progress*5+(4-Math.abs(4-x))*2;
      if(t===G.H||t===G.E)value+=(4-Math.abs(4-x))*4+Math.min(progress,6)*2;
      if(t===G.R||t===G.C)value+=Math.min(progress,6)*2;
      score+=s*value;
    }
    return score*p.turn;
  }
  function order(p,actions,preferred){
    const value=a=>{
      if(preferred&&G.sameAction(a,preferred))return 10000000;
      if(a.pass)return -100000;
      const taken=G.VALUES[G.type(p.board[a.to])]||0,moving=G.VALUES[G.type(p.board[a.from])]||0;
      return taken*1000-moving*2+(G.type(p.board[a.from])===G.P?(Math.floor(a.from/9)-Math.floor(a.to/9))*p.turn*5:0);
    };
    return actions.slice().sort((a,b)=>value(b)-value(a)||(a.from??99)-(b.from??99)||(a.to??99)-(b.to??99));
  }
  function chooseMove(state,options={}){
    if(state.over)return null;
    if(state.kind==='puzzle')return G.matingMoves(state)[0]||G.legalMoves(state)[0]||null;
    const config=G.DIFFICULTIES[state.difficulty]||G.DIFFICULTIES.medium;
    const maxDepth=Math.max(1,Math.min(5,options.depth??config.depth)),budget=Math.max(64,Math.min(20000,options.nodes??config.nodes));
    const root=G.legalActions(state);if(!root.length)return null;
    let nodes=0,best=order(state,root)[0],completedDepth=0;
    function search(p,depth,alpha,beta,ply){
      if(++nodes>budget)throw STOP;
      if(p.over){const terminal=p.reason==='mate'?MATE:MATE-10000;return p.winner===p.turn?terminal-ply:-terminal+ply;}
      const checked=G.inCheck(p.board,p.turn);
      if(depth<=0){if(checked&&!G.legalMoves(p).length)return -MATE+ply;return evaluate(p)-(checked?70:0);}
      const actions=G.legalActions(p);if(!actions.length)return -MATE+ply;
      let value=-Infinity;
      for(const action of order(p,actions)){
        const score=-search(G.advance(p,action,false),depth-1,-beta,-alpha,ply+1);
        if(score>value)value=score;if(score>alpha)alpha=score;if(alpha>=beta)break;
      }
      return value;
    }
    for(let depth=1;depth<=maxDepth;depth++){
      let choice=best,value=-Infinity,alpha=-Infinity;
      try{
        for(const action of order(state,root,best)){
          const score=-search(G.advance(state,action,false),depth-1,-Infinity,-alpha,1);
          if(score>value){value=score;choice=action;}if(score>alpha)alpha=score;
        }
        best=choice;completedDepth=depth;if(value>MATE-100)break;
      }catch(error){if(error!==STOP)throw error;break;}
    }
    if(options.diagnostics)Object.assign(options.diagnostics,{nodes:Math.min(nodes,budget),depth:completedDepth});
    return best;
  }
  return {chooseMove,evaluate};
})();
if(typeof module!=='undefined')module.exports=JanggiAI;
