/* 오직 Gostop.view()의 공개 정보만 받는 결정적 컴퓨터. */
const GostopAI = (() => {
  const G=typeof Gostop!=='undefined'?Gostop:require('./logic.js');
  const weight=(id,v,level)=>{
    const c=G.cards[id],mine=v.captured[v.player];
    let n=c.pi?c.pi*2:c.type==='광'?5:c.type==='열'?3:3.5;
    if(level==='easy')return n;
    const before=G.score(mine),after=G.score([...mine,id]);n+=(after.total-before.total)*5;
    if(c.set&&mine.some(x=>G.cards[x].set===c.set))n+=2;
    if([4,12,29].includes(id))n+=mine.filter(x=>[4,12,29].includes(x)).length*3;
    if(level==='hard'){
      const opp=v.captured[1-v.player];
      if(c.set&&opp.filter(x=>G.cards[x].set===c.set).length===2)n+=4;
      if(c.type==='광'&&G.score(opp).bright===2)n+=3;
    }
    return n;
  };
  function choose(v,level='medium') {
    if(!v||!Array.isArray(v.actions)||v.actions.length===0)return null;
    if(v.phase==='decision')return v.actions.find(a=>a.type==='stop'); // 점수 확정 우선, 모든 난이도 동일
    const rank=a=>{
      if(a.type==='bomb')return 45;
      if(a.type==='shake')return level==='easy'?-100:20;
      if(a.type==='choose')return weight(a.id,v,level);
      if(a.type==='skip')return -1;
      const c=G.cards[a.id],matches=v.table.filter(id=>G.cards[id].month===c.month);
      if(matches.length)return weight(a.id,v,level)+Math.max(...matches.map(id=>weight(id,v,level)))+(matches.length===3?20:0);
      const twins=v.hand.filter(id=>G.cards[id].month===c.month).length;
      return -weight(a.id,v,level)+(twins===3?-10:0);
    };
    return [...v.actions].sort((a,b)=>rank(b)-rank(a)||JSON.stringify(a).localeCompare(JSON.stringify(b)))[0];
  }
  return {choose};
})();
if(typeof module!=='undefined')module.exports=GostopAI;
