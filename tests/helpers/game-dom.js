// 실제 게임 UI를 실행하기 위한 최소 DOM·시계·Worker 대역.
// CSS 배치·실제 브라우저 렌더링은 검사하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '../..');

module.exports = function gameDom(id, { saved = {}, blockedStorage = false, hash = '', search, workers = true, scripts = [], beforeUI = '' } = {}) {
  const pool = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.listeners = {};
      this.dataset = {}; this.attributes = {}; this.className = ''; this.hidden = false; this._text = ''; this.disabled = false;
      this.style = { setProperty: (key, value) => { this.style[key] = String(value); } };
      this.classList = { toggle: (name, on) => {
        const classes = new Set(this.className.split(' ').filter(Boolean));
        if (on === undefined) on = !classes.has(name);
        if (on) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(' ');
      }, add:(...names)=>names.forEach(name=>this.classList.toggle(name,true)), remove:(...names)=>names.forEach(name=>this.classList.toggle(name,false)), contains:name=>this.className.split(' ').includes(name) };
      pool.push(this);
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._text; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    append(...children) { children.forEach((child) => { child.parentElement = this; this.children.push(child); }); }
    appendChild(child) { this.append(child); return child; }
    replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    fire(type, event = {}) {
      if (type === 'click' && this.disabled) return;
      for (const callback of this.listeners[type] || []) callback({ target: this, button: 0, detail: 0, preventDefault() {}, ...event });
    }
    focus() { document.activeElement = this; }
    closest(selector) {
      for (let element = this; element; element = element.parentElement) {
        if(selector[0]==='.'&&element.classList.contains(selector.slice(1)))return element;
        if (selector[0] === '#' && element.id === selector.slice(1)) return element;
        if (selector === 'button' && element.tagName === 'BUTTON') return element;
      }
      return null;
    }
  }
  const html = fs.readFileSync(path.join(ROOT, id, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = match[2];
    if (!/\bid="|class="[^"]*(?:dark-toggle|large-text-toggle|sound-toggle)/.test(attrs)) continue;
    const element = new Element(match[1]);
    element.id = attrs.match(/\bid="([^"]+)"/)?.[1];
    element.className = attrs.match(/\bclass="([^"]*)"/)?.[1] || '';
    element.hidden = /\bhidden\b/.test(attrs); element.disabled = /\bdisabled\b/.test(attrs);
  }
  const document = new Element('document'); document.documentElement = new Element('html'); document.body = new Element('body'); document.hidden = false;
  document.getElementById = (key) => pool.find((element) => element.id === key) || null;
  document.createElement = (tag) => new Element(tag);
  document.createTextNode = (text) => { const element = new Element('text'); element.textContent = text; return element; };
  const themeMeta={content:''};
  document.querySelector = (selector) => selector==='meta[name="theme-color"]'?themeMeta:null;
  document.querySelectorAll = (selector) => pool.filter((element) => selector.startsWith('.') && element.className.split(' ').includes(selector.slice(1)));
  const store = new Map(Object.entries(saved).map(([key, value]) => [key, JSON.stringify(value)]));
  const timers = new Map(), instances = [];
  let now = 0, nextId = 0;
  const timeout = (callback, delay = 0, interval = false) => {
    const number = ++nextId; timers.set(number, { at: now + delay, callback, interval: interval ? delay : 0 }); return number;
  };
  class FakeWorker {
    constructor(url) { this.url = url; this.terminated = false; instances.push(this); }
    postMessage(data) { this.data = JSON.parse(JSON.stringify(data)); }
    terminate() { this.terminated = true; }
    reply(move) { this.onmessage({ data: { id: this.data.id, move: move ?? search(this.data.state, this.data.options) } }); }
  }
  const window = new Element('window'); window.scrollTo = () => {};
  const location = { protocol: 'file:', hostname: '', hash, pathname: `/${id}/`, search: '' };
  const context = vm.createContext({
    document, window, location, navigator: {}, console,
    history: { replaceState: () => { location.hash = ''; } }, performance: { now: () => now },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: {
      getItem: (key) => { if (blockedStorage) throw Error('차단'); return store.get(key) || null; },
      setItem: (key,value) => { if (blockedStorage) throw Error('차단'); store.set(key,value); },
      removeItem: (key) => { if (blockedStorage) throw Error('차단'); store.delete(key); },
    },
    setTimeout: (callback,delay) => timeout(callback,delay), clearTimeout: (key) => timers.delete(key),
    setInterval: (callback,delay) => timeout(callback,delay,true), clearInterval: (key) => timers.delete(key),
    Worker: workers ? FakeWorker : undefined,
    MaeilFx: { play() {}, pulse() {}, buzz() {}, countUp() {}, celebrate() {} },
  });
  vm.runInContext(`Date.now = () => ${Date.parse('2026-11-23T03:00:00Z')}`, context);
  const engine=id==='sudoku'?['sudoku/js/generator.js','sudoku/js/game.js','sudoku/js/storage.js']:id==='gostop'?[`${id}/js/logic.js`,`${id}/js/ai.js`,`${id}/js/art.js`]:['janggi','go'].includes(id)?[`${id}/js/logic.js`,`${id}/js/ai.js`]:[`${id}/js/logic.js`];
  for (const file of ['common/core.js', 'common/start.js', ...scripts, ...engine, `${id}/js/ui.js`]) {
    if(file===`${id}/js/ui.js`&&beforeUI)vm.runInContext(beforeUI,context,{filename:'test-setup.js'});
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{ filename:file });
  }
  return {
    document, window, workers: instances,
    element: (key) => document.getElementById(key),
    click: (key) => document.getElementById(key).fire('click'),
    key: (key,target = document.activeElement) => document.fire('keydown',{ key, target, repeat:false }),
    get: (key) => store.has(key) ? JSON.parse(store.get(key)) : null,
    advance: (ms) => {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end,now+16);
        for (const [key,timer] of [...timers]) {
          if (timer.at > now || !timers.has(key)) continue;
          if (timer.interval) timer.at += timer.interval; else timers.delete(key);
          timer.callback();
        }
      }
    },
  };
};
