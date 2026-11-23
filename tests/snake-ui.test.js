// 실제 core/start/logic/ui 코드를 실행해 저장·출석·화면 전환을 검사한다.
// 최소 DOM 대역을 사용하므로 CSS 배치나 실제 터치 기기 검사를 대신하지 않는다.
// 실행: node --test tests/snake-ui.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Snake = require('../snake/js/logic.js');
const ROOT = path.join(__dirname, '..');
const GAME = 'maeil-game.snake.game.v1';
const STATS = 'maeil-game.snake.stats.v1';
const DAILY = 'maeil-game.snake.daily.v1';
const ATTENDANCE = 'maeil-game.daily.v1';

function browser({ saved = {}, blockedStorage = false, hash = '' } = {}) {
  const pool = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.dataset = {};
      this.attributes = {}; this.className = ''; this.hidden = false; this._text = '';
      this.classList = {
        toggle: (name, on) => {
          const classes = new Set(this.className.split(' ').filter(Boolean));
          if (on === undefined) on = !classes.has(name);
          if (on) classes.add(name); else classes.delete(name);
          this.className = [...classes].join(' ');
        },
      };
      pool.push(this);
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._text; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); return child; }
    replaceChildren(...children) { this.children = children; this._text = ''; }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    fire(type, event = {}) {
      for (const callback of this.listeners[type] || []) callback({ target: this, button: 0, detail: 0, preventDefault() {}, ...event });
    }
    focus() {}
    closest(selector) { return selector === 'button' && this.tagName === 'BUTTON' ? this : null; }
    setPointerCapture() {}
  }
  const html = fs.readFileSync(path.join(ROOT, 'snake/index.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = match[2];
    if (!/\bid="|data-direction=|class="[^"]*(?:dark-toggle|large-text-toggle|sound-toggle)/.test(attrs)) continue;
    const element = new Element(match[1]);
    element.id = attrs.match(/\bid="([^"]+)"/)?.[1];
    element.className = attrs.match(/\bclass="([^"]*)"/)?.[1] || '';
    element.hidden = /\bhidden\b/.test(attrs);
    const direction = attrs.match(/data-direction="([^"]+)"/)?.[1];
    if (direction) element.dataset.direction = direction;
  }
  const document = new Element('document');
  document.documentElement = new Element('html');
  document.body = new Element('body');
  document.hidden = false;
  document.getElementById = (id) => pool.find((element) => element.id === id) || null;
  document.createElement = (tag) => new Element(tag);
  document.createTextNode = (text) => { const element = new Element('text'); element.textContent = text; return element; };
  document.querySelector = () => null;
  document.querySelectorAll = (selector) => pool.filter((element) => selector === '[data-direction]'
    ? Boolean(element.dataset.direction) : selector.startsWith('.') && element.className.split(' ').includes(selector.slice(1)));
  const store = new Map(Object.entries(saved).map(([key, value]) => [key, JSON.stringify(value)]));
  let now = 0, nextId = 0;
  const frames = new Map();
  const timers = new Map();
  const window = new Element('window');
  window.scrollTo = () => {};
  const location = { protocol: 'file:', hostname: '', hash, pathname: '/snake/', search: '' };
  const context = vm.createContext({
    document, window, location, navigator: {},
    history: { replaceState: () => { location.hash = ''; } },
    console, performance: { now: () => now },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: {
      getItem: (key) => { if (blockedStorage) throw Error('차단'); return store.get(key) || null; },
      setItem: (key, value) => { if (blockedStorage) throw Error('차단'); store.set(key, value); },
      removeItem: (key) => { if (blockedStorage) throw Error('차단'); store.delete(key); },
    },
    requestAnimationFrame: (callback) => { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback, delay) => { timers.set(++nextId, { at: now + delay, callback }); return nextId; },
    clearTimeout: (id) => timers.delete(id),
    MaeilFx: { play() {}, pulse() {}, buzz() {}, countUp() {}, celebrate() {} },
  });
  vm.runInContext(`Date.now = () => ${Date.parse('2026-11-23T03:00:00Z')}`, context);
  for (const file of ['common/core.js', 'common/start.js', 'snake/js/logic.js', 'snake/js/ui.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  return {
    document, window,
    element: (id) => document.getElementById(id),
    click: (id) => document.getElementById(id).fire('click'),
    key: (key) => document.fire('keydown', { key, repeat: false }),
    get: (key) => store.has(key) ? JSON.parse(store.get(key)) : null,
    advance: (ms) => {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + 16);
        const pending = [...frames.values()]; frames.clear();
        pending.forEach((callback) => callback(now));
        for (const [id, timer] of [...timers]) {
          if (timer.at <= now) { timers.delete(id); timer.callback(); }
        }
      }
    },
  };
}

test('실제 난이도 선택·출발 대기·방향키 출발', () => {
  const b = browser();
  assert.equal(b.element('game-screen').hidden, true);
  b.element('difficulty-list').children[0].fire('click');
  b.click('start-btn');
  assert.equal(b.get(GAME).difficulty, 'easy');
  assert.equal(b.element('game-screen').hidden, false);
  const head = b.get(GAME).body[0];
  b.advance(1500);
  assert.equal(b.get(GAME).body[0], head);
  b.key('ArrowUp');
  b.advance(340);
  assert.equal(b.get(GAME).body[0], head - 16);
});

test('일시정지 중에는 이동하지 않고, 처음 화면에서 이어하기 가능', () => {
  const b = browser();
  b.click('start-btn'); b.click('resume-btn'); b.advance(240);
  b.click('pause-btn');
  const state = b.get(GAME);
  b.advance(3000);
  assert.deepEqual(b.get(GAME), state);
  b.click('home-btn');
  assert.equal(b.element('continue-wrap').hidden, false);
  b.click('continue-btn');
  b.advance(500);
  assert.deepEqual(b.get(GAME), state);
  b.click('resume-btn'); b.advance(240);
  assert.equal(b.get(GAME).moves, state.moves + 1);
});

test('다른 탭으로 가거나 뒤로 돌아오면 정지 상태 유지', () => {
  const b = browser();
  b.click('start-btn'); b.key('ArrowUp'); b.advance(240);
  b.document.hidden = true; b.document.fire('visibilitychange');
  const state = b.get(GAME);
  b.advance(2000);
  b.document.hidden = false; b.window.fire('pageshow', { persisted: true });
  b.advance(2000);
  assert.deepEqual(b.get(GAME), state);
  assert.equal(b.element('pause-overlay').hidden, false);
});

test('판 위 밀기와 방향 버튼 모두 실제 이동에 연결', () => {
  const b = browser();
  b.click('start-btn');
  const area = b.element('board-area');
  area.fire('pointerdown', { pointerId: 1, clientX: 80, clientY: 90 });
  area.fire('pointermove', { pointerId: 1, clientX: 80, clientY: 50 });
  area.fire('pointerup', { pointerId: 1, clientX: 80, clientY: 50 });
  b.advance(240);
  assert.equal(b.get(GAME).direction, 'up');
  b.document.querySelectorAll('[data-direction]').find((button) => button.dataset.direction === 'left').fire('click');
  b.advance(240);
  assert.equal(b.get(GAME).direction, 'left');
});

function nearGoal(date, head = 141) {
  const game = Snake.create('medium', { daily: date });
  Object.assign(game, { body: Array.from({ length: 13 }, (_, i) => head - i), food: head === 143 ? 0 : head + 1, eaten: 9, score: 90, moves: 30 });
  assert.ok(Snake.isValid(game));
  return game;
}

test('먹이 10개 달성 시 출석, 종료 후 기록·요약 저장은 한 번만', () => {
  const date = '2026-11-23';
  const b = browser({ saved: { [GAME]: nearGoal(date) } });
  b.click('continue-btn'); b.click('resume-btn'); b.advance(240);
  assert.ok(b.get(ATTENDANCE).done[date].includes('snake'));
  assert.equal(b.get(DAILY).score, 100);
  b.advance(2000);
  assert.equal(b.element('result-screen').hidden, false);
  assert.equal(b.get(GAME), null);
  assert.equal(b.get(STATS).daily.played, 1);
  assert.ok(b.get('maeil-game.summary.v1').snake.includes('100'));
  b.advance(2000);
  assert.equal(b.get(STATS).daily.played, 1);
});

test('목표 이전에 끝나면 출석 처리하지 않음', () => {
  const b = browser({ saved: { [GAME]: nearGoal('2026-11-23', 143) } });
  b.click('continue-btn'); b.click('resume-btn'); b.advance(1000);
  assert.equal(b.get(ATTENDANCE), null);
  assert.equal(b.get(STATS).daily.best, 90);
});

test('지난 날짜 이어하기가 오늘의 최고 도전 점수를 덮어쓰지 않음', () => {
  const current = { date: '2026-11-23', score: 500, eaten: 50 };
  const b = browser({ saved: { [GAME]: nearGoal('2026-11-22'), [DAILY]: current } });
  b.click('continue-btn'); b.click('resume-btn'); b.advance(240);
  assert.deepEqual(b.get(DAILY), current);
});

test('저장소가 차단되어도 시작·종료 가능, #daily는 오늘의 도전으로 진입', () => {
  const b = browser({ blockedStorage: true, hash: '#daily' });
  assert.equal(b.element('game-screen').hidden, false);
  b.click('resume-btn'); b.advance(4000);
  assert.equal(b.element('result-screen').hidden, false);
  assert.equal(b.get(STATS), null);
});
