const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../word-search/js/logic.js');

test('12개 주제의 단어가 중복 없는 한글 2~4글자이며 각 난이도 크기에 들어간다',()=>{
  assert.equal(G.THEMES.length,12);
  for(const t of G.THEMES){assert.equal(t.words.length,8);assert.equal(new Set(t.words).size,8);assert.ok(t.words.every(w=>/^[가-힣]{2,4}$/.test(w)));}
});
test('세 난이도 365판에서 목표 단어가 정확히 한 곳에 존재하고 허용 방향으로 배치된다',()=>{
  for(const [difficulty,c] of Object.entries(G.DIFFICULTIES))for(let day=0;day<365;day++){
    const s=G.create(difficulty,{seed:`verify:${day}`});assert.equal(s.size,c.size);assert.equal(s.words.length,c.count);
    for(let i=0;i<s.words.length;i++){
      const w=s.words[i],p=s.placements[i];assert.equal(p.map(n=>s.grid[n]).join(''),w);
      // Independent scan of all eight directions, without using the game's path scanner.
      let hits=0;
      for(let r=0;r<s.size;r++)for(let col=0;col<s.size;col++)for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc)continue;
        const chars=[];
        for(let j=0;j<w.length;j++){const rr=r+dr*j,cc=col+dc*j;if(rr<0||cc<0||rr>=s.size||cc>=s.size)break;chars.push(s.grid[rr*s.size+cc]);}
        if(chars.join('')===w)hits++;
      }
      assert.equal(hits,1,`${difficulty}/${day}/${w}`);
      const dr=Math.sign(Math.floor(p[1]/s.size)-Math.floor(p[0]/s.size)),dc=Math.sign(p[1]%s.size-p[0]%s.size);
      assert.ok(c.directions.some(d=>d[0]===dr&&d[1]===dc));
    }
  }
});
test('같은 날짜·시드는 같은 판이고 다른 날짜에는 다른 판',()=>{
  assert.deepEqual(G.create('normal',{daily:'2026-11-29'}),G.create('normal',{daily:'2026-11-29'}));
  assert.notDeepEqual(G.create('normal',{daily:'2026-11-29'}).grid,G.create('normal',{daily:'2026-11-30'}).grid);
});
test('꺾인 경로·줄바꿈·잘못된 좌표는 거부하며 양끝 역순 선택을 인정',()=>{
  assert.deepEqual(G.path(6,5,6),[]);assert.deepEqual(G.path(6,0,8),[]);assert.deepEqual(G.path(6,-1,4),[]);assert.deepEqual(G.path(6,0,36),[]);
  const s=G.create('normal',{seed:'select'}),p=s.placements[0];
  assert.equal(G.select(s,p.at(-1),p[0]),'found');assert.equal(G.select(s,p[0],p.at(-1)),'repeated');assert.deepEqual(s.found,[0]);
});
test('힌트는 단어별 한 번이며 되돌려도 사용량 보존, 완료 뒤 상태 변경 금지',()=>{
  const s=G.create('hard',{seed:'hints'});assert.equal(G.hint(s),0);assert.equal(s.hints,1);
  const p=s.placements[0];G.select(s,p[0],p.at(-1));assert.equal(G.undo(s),true);assert.equal(s.hints,1);assert.equal(G.hint(s),1);
  for(const p of s.placements)G.select(s,p[0],p.at(-1));assert.ok(G.isDone(s));
  const frozen=structuredClone(s);assert.equal(G.hint(s),-1);assert.equal(G.undo(s),false);assert.equal(G.select(s,0,1),'finished');assert.deepEqual(s,frozen);
});
test('저장 복원 검사는 손상·중복 완료·변조된 판·잘못된 날짜를 거부',()=>{
  const s=G.create('normal',{daily:'2026-11-29'});G.hint(s);const p=s.placements[0];G.select(s,p[0],p.at(-1));assert.ok(G.isValid(JSON.parse(JSON.stringify(s))));
  for(const mutate of [x=>x.found.push(0),x=>x.found.push(-1),x=>x.grid[0]='!',x=>x.hints=-1,x=>x.daily='2026-02-30',x=>x.seed='bad',x=>x.placements[0].reverse(),x=>x.words.reverse()]){const bad=structuredClone(s);mutate(bad);assert.equal(G.isValid(bad),false);}
  for(const value of [null,{},[],{version:1,difficulty:'unknown'}])assert.equal(G.isValid(value),false);
});
