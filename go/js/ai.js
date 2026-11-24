/* 기기 안에서 제한 탐색하는 연습 상대. 전문 바둑 엔진의 기력은 보장하지 않는다. */
(function(root,factory){const api=factory(typeof GoGame!=='undefined'?GoGame:require('./logic.js'));if(typeof module==='object'&&module.exports)module.exports=api;else root.GoAI=api;})(globalThis,G=>{
  'use strict';
  function eye(b,at,color){
    if(!G.NEIGHBORS[at].every(i=>b[i]===color))return false;
    const x=at%9,y=Math.floor(at/9),diags=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,c])=>[x+a,y+c]).filter(([a,c])=>a>=0&&a<9&&c>=0&&c<9);
    const bad=diags.filter(([a,c])=>b[c*9+a]!==color).length;return bad<=(diags.length===4?1:0);
  }
  function candidates(p){
    const own=p.turn,atari=new Set(),threats=new Set();
    for(let i=0;i<81;i++)if(p.board[i]){const g=G.group(p.board,i);if(g.liberties.length===1)(p.board[i]===own?atari:threats).add(g.liberties[0]);}
    const out=[];
    for(const at of G.legalMoves(p)){
      const t=G.tryMove(p,at);if(eye(p.board,at,own)&&!t.captured.length)continue;
      const adj=G.NEIGHBORS[at],x=at%9,y=Math.floor(at/9),edge=Math.min(x,y,8-x,8-y),friends=adj.filter(i=>p.board[i]===own).length,enemies=adj.filter(i=>p.board[i]===-own).length;
      let value=t.captured.length*120+(atari.has(at)?50:0)+(threats.has(at)?14:0)+(t.liberties.length===1?-95:0);
      value+=Math.min(t.liberties.length,5)*2+(edge===2?7:edge===1?3:edge===0?-4:4)+enemies*3+friends*2;
      // Avoid filling settled territory; value an unclaimed third-line opening.
      if(p.ply<18){let near=9;for(let i=0;i<81;i++)if(p.board[i])near=Math.min(near,Math.abs(i%9-x)+Math.abs(Math.floor(i/9)-y));value+=Math.min(near,4)*3;}
      for(const n of adj)if(t.board[n]===-own&&G.group(t.board,n).liberties.length===1)value+=8;
      out.push({at,value,next:{...p,board:t.board,turn:-own,keys:[...p.keys,G.key(t.board)],ply:p.ply+1,passes:0}});
    }
    return out.sort((a,b)=>b.value-a.value||a.at-b.at);
  }
  function random(seed){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
  function chooseMove(p,{samples=4}={}){
    if(p.over||p.phase!=='play'||p.attempted)return null;
    if(p.kind==='puzzle')return {at:G.puzzleMoves(p)[0]};
    const moves=candidates(p);if(!moves.length)return {pass:true};
    // Pass after the opponent when no capture, rescue or neutral point remains.
    const area=G.score(p.board),neutral=area.ownership.some((v,i)=>!p.board[i]&&!v);
    if(p.passes&&p.ply>=25&&moves[0].value<45&&!neutral)return {pass:true};
    const r=random(G.key(p.board)+p.turn),budget=Math.max(0,Math.min(12,Number(samples)||0)),top=moves.slice(0,budget?6:1);
    let best=top[0],bestValue=-Infinity;
    for(const m of top){let total=0;
      for(let j=0;j<budget;j++){
        let q=m.next;
        // Short tactical rollouts, not a professional life-and-death solver.
        for(let k=0;k<4;k++){const opts=candidates(q).slice(0,3);if(!opts.length)break;q=opts[Math.floor(r()*opts.length)].next;}
        const s=G.score(q.board);total+=(s.black-s.white)*p.turn;
      }
      const value=m.value+(budget?total/budget*.65:0);if(value>bestValue){best=m;bestValue=value;}
    }
    return {at:best.at};
  }
  return {chooseMove,eye};
});
