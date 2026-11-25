const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Art = require('../gostop/js/art');
const G = require('../gostop/js/logic');
const dom = require('./helpers/game-dom');
const root = path.join(__dirname, '..');

test('화투 48장 원본·개별 라이선스·한국식 달/종류 대응과 오프라인 보관', () => {
  const sources = require('../gostop/cards/sources.json');
  const ancestors = require('../gostop/cards/upstream-sources.json');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.equal(sources.length, 48);
  assert.equal(new Set(sources.map(s => s.file)).size, 48);
  assert.equal(ancestors.length, 48);
  for (const id of G.cards.map(c => c.id)) {
    const file = Art.src(id), source = sources.find(s => file.endsWith('/' + s.file));
    assert.ok(source, `출처 누락: ${id}`);
    assert.equal(source.license, 'CC BY-SA 4.0');
    assert.match(source.descriptionWikitext, /\{\{self\|cc-by-sa-4\.0\}\}/);
    assert.equal(source.modified, false);
    assert.equal(source.upstream.length, 1);
    assert.ok(ancestors.some(a => a.title === source.upstream[0].title && a.license === 'CC BY-SA 4.0'));
    const data = fs.readFileSync(path.join(root, 'gostop', file));
    assert.equal(crypto.createHash('sha1').update(data).digest('hex'), source.originalSha1);
    const svg = data.toString();
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|(?:href|src)=["'](?:https?:|data:)/i);
    assert.ok(sw.includes(`'gostop/${file}'`), `오프라인 누락: ${file}`);
    const category = G.cards[id].type === '광' ? 'gwang' : G.cards[id].type === '띠' ? 'tti' : G.cards[id].type === '열' ? 'yul' : G.cards[id].pi === 2 ? 'ssang_pi' : 'pi_';
    assert.ok(file.includes(category), `종류 불일치: ${id} ${file}`);
  }
  assert.match(Art.src(40), /November_gwang/);
  assert.match(Art.src(41), /November_ssang_pi/);
  assert.match(Art.src(44), /December_gwang/);
  assert.match(Art.src(47), /December_ssang_pi/);
  assert.ok(sw.includes("'gostop/cards/Hwatu_back.svg'"));
});

test('도움 표시 기본 켬·설정 보존·패 선택/게임/오늘 도전 상태 유지', () => {
  const key = 'maeil-game.gostop.game.v1', help = 'maeil-game.gostop.help.v1';
  const b = dom('gostop', {hash: '#daily'});
  const before = b.get(key);
  assert.equal(b.element('help-toggle').attributes['aria-pressed'], 'true');
  assert.match(b.element('hand').children[0].innerHTML, /month-badge/);
  b.click('help-toggle');
  assert.equal(b.get(help), false);
  assert.doesNotMatch(b.element('hand').children[0].innerHTML, /month-badge/);
  assert.deepEqual(b.get(key), before);
  const reloaded = dom('gostop', {saved: {[key]: before, [help]: false}});
  reloaded.click('continue-btn');
  assert.equal(reloaded.element('help-toggle').attributes['aria-pressed'], 'false');
  assert.doesNotMatch(reloaded.element('hand').children[0].innerHTML, /month-badge/);
  if (before.state.turn === 1) reloaded.advance(7000);
  reloaded.element('hand').children[0].fire('click');
  const selected = reloaded.element('selected-info').textContent, state = reloaded.get(key);
  reloaded.click('help-toggle');
  assert.equal(reloaded.element('selected-info').textContent, selected);
  assert.deepEqual(reloaded.get(key), state);
  assert.match(reloaded.element('hand').children[0].innerHTML, /month-badge/);
});
