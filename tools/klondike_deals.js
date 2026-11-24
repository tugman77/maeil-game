// 전체 카드 정보를 알고 푸는 오프라인 탐색기. 브라우저에는 검증 데이터만 제공한다.
const fs=require('node:fs'),path=require('node:path');
const G=require('../klondike/js/logic.js');
class Heap {
  constructor() { this.items = []; }
  push(node) {
    const a = this.items; a.push(node); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].priority >= node.priority) break; a[i] = a[p]; i = p; }
    a[i] = node;
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].priority > a[c].priority) c++;
        if (last.priority >= a[c].priority) break;
        a[i] = a[c]; i = c;
      }
      a[i] = last;
    }
    return first;
  }
}

function canonical(s){return s.foundations.join(',')+'|'+s.stock.join(',')+'|'+s.waste.join(',')+'|'+s.columns.map((c,i)=>s.hidden[i]+':'+c.join(',')).sort().join(';');}
function normalize(s){const moves=[];let m;while((m=G.safeMove(s))){G.apply(s,m.from,m.to);moves.push(m);}return moves;}
function value(s,depth){return G.foundationCount(s)*18-s.hidden.reduce((a,n)=>a+n,0)*15+s.columns.filter(c=>!c.length).length*3-depth*.03;}
function solve(initial,limit=10000){
 const state=G.snapshot(initial),actions=normalize(state),heap=new Heap();heap.push({state,actions,parent:null,depth:actions.length,priority:value(state,actions.length)});const seen=new Set([canonical(state)]);let expanded=0;
 while(heap.items.length&&expanded++<limit){const node=heap.pop();if(G.isDone(node.state)){const parts=[];for(let n=node;n;n=n.parent)parts.push(n.actions);const solution=parts.reverse().flat();if(!G.verifySolution(initial,solution))throw Error('수순 검증 실패');return{solution,expanded};}
  if(node.depth>700)continue;
  for(const action of G.legalMoves(node.state,{foundationBack:false})){const next=G.snapshot(node.state);G.applyAction(next,action);const actions=[action,...normalize(next)],key=canonical(next);if(seen.has(key))continue;seen.add(key);const depth=node.depth+actions.length;heap.push({state:next,actions,parent:node,depth,priority:value(next,depth)});}
 }
 return null;
}
function encode(a){if(a.type==='draw')return[-1];const loc=p=>p.type==='column'?p.index:p.type==='waste'?7:p.index+8;return[loc(a.from),loc(a.to),a.from.start??null];}
if(require.main===module){const count=Number(process.argv[2]||48),limit=Number(process.argv[3]||10000),deals=[];for(let seed=1;seed<=1000&&deals.length<count;seed++){const result=solve(G.rawDeal(seed),limit);if(!result){console.log(`판 ${seed}: 탐색 한도 내 풀이 없음`);continue;}deals.push({seed,solution:result.solution.map(encode)});console.log(`판 ${seed}: ${result.solution.length}수, ${result.expanded}노드 (${deals.length}/${count})`);}
 if(deals.length<count)throw Error('검증 판 부족');deals.sort((a,b)=>a.solution.length-b.solution.length);deals.forEach((d,i)=>d.difficulty=i<count/3?'easy':i<count*2/3?'medium':'hard');fs.writeFileSync(path.join(__dirname,'../klondike/js/deals.js'),'// 자체 생성·풀이 재검증한 한 장 뽑기 클론다이크. tools/klondike_deals.js로 생성.\nconst KlondikeDeals='+JSON.stringify(deals)+';\nif(typeof module!=="undefined")module.exports=KlondikeDeals;\n');console.log(`${count}판 저장 완료`);
}
module.exports={solve};
