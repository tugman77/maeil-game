// 자체 규칙 엔진으로 무작위 프리셀 판을 풀고, 모든 이동을 재검증한 수순만 보관한다.
// 실행: node tools/freecell_deals.js [개수=24] [탐색 노드=12000]
// 브라우저에는 이 탐색기를 넣지 않는다. js/deals.js에 검증된 데이터만 저장한다.
const fs = require('node:fs');
const path = require('node:path');
const G = require('../freecell/js/logic.js');

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
function canonical(s) {
  return s.foundations.join(',') + '|' + s.free.filter((n) => n !== null).sort((a,b) => a-b).join(',')
    + '|' + s.columns.map((c) => c.join(',')).sort().join(';');
}
function normalize(s) {
  const actions = []; let m;
  while ((m = G.safeMove(s))) { G.apply(s, m.from, m.to); actions.push(m); }
  return actions;
}
function value(s, depth) {
  let score = G.foundationCount(s) * 14 + s.free.filter((n) => n === null).length * 5
    + s.columns.filter((c) => !c.length).length * 14 - depth * .08;
  for (const column of s.columns) {
    for (let i = 0; i < column.length; i++) {
      const card = column[i], wanted = G.rank(card) - s.foundations[G.suit(card)];
      if (wanted <= 4) score -= (5 - wanted) * (column.length - i - 1) * 1.8;
      if (i > 0 && G.fits(card, column[i-1])) score += 2;
    }
  }
  return score;
}
function solve(initial, limit = 12000) {
  const state = G.snapshot(initial), actions = normalize(state), heap = new Heap();
  const root = { state, actions, parent: null, depth: actions.length, priority: value(state, actions.length) };
  heap.push(root); const seen = new Set([canonical(state)]); let expanded = 0;
  while (heap.items.length && expanded++ < limit) {
    const node = heap.pop();
    if (G.isDone(node.state)) {
      const chunks = [];
      for (let n = node; n; n = n.parent) chunks.push(n.actions);
      const moves = chunks.reverse().flat();
      if (!G.verifySolution(initial, moves)) throw new Error('생성 수순 검증 실패');
      return { solution: moves, expanded };
    }
    if (node.depth >= 300) continue;
    for (const move of G.legalMoves(node.state)) {
      const next = G.snapshot(node.state); G.apply(next, move.from, move.to);
      const actions = [move, ...normalize(next)], key = canonical(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const depth = node.depth + actions.length;
      heap.push({ state: next, actions, depth, parent: node, priority: value(next, depth) });
    }
  }
  return null;
}
if (require.main === module) {
  const count = Number(process.argv[2] || 24), limit = Number(process.argv[3] || 12000), deals = [];
  const started = Date.now();
  for (let seed = 1; seed <= 500 && deals.length < count; seed++) {
    const result = solve(G.rawDeal(seed), limit);
    if (!result) { console.log(`판 ${seed}: 탐색 한도 내 풀이 없음`); continue; }
    deals.push({ seed, solution: result.solution, searchNodes: result.expanded });
    console.log(`판 ${seed}: ${result.solution.length}수, ${result.expanded}노드 (${deals.length}/${count})`);
  }
  if (deals.length !== count) throw new Error('검증 판 수 부족');
  deals.sort((a,b) => a.solution.length - b.solution.length || a.searchNodes - b.searchNodes);
  deals.forEach((d, i) => { d.difficulty = i < count/3 ? 'easy' : i < count*2/3 ? 'medium' : 'hard'; });
  const output = '// 자체 생성·풀이 재검증한 프리셀 판. tools/freecell_deals.js로 갱신한다.\nconst FreeCellDeals = '
    + JSON.stringify(deals) + ';\nif (typeof module !== "undefined") module.exports = FreeCellDeals;\n';
  fs.writeFileSync(path.join(__dirname, '../freecell/js/deals.js'), output);
  console.log(`${count}판 저장 완료 · ${((Date.now()-started)/1000).toFixed(1)}초`);
}
module.exports = { solve };
