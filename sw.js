// 오프라인 동작(사이트 전체 공용): 게임 파일을 기기에 보관해 두고, 인터넷이 끊기면 보관본으로 연다.
// 인터넷이 될 때는 항상 서버의 최신 파일을 먼저 받아 오므로, 수정한 내용이 바로 반영된다.
// ⚠️ 게임이나 파일을 추가하면 FILES 목록에도 넣는다(tests/common.test.js가 빠진 파일을 잡는다).
const CACHE = 'maeil-game-v10';
const FILES = [
  './',
  'index.html',
  'hub.css',
  'hub.js',
  'games.json',
  'about.html',
  'privacy.html',
  'common/base.css',
  'common/core.js',
  'common/game.css',
  'common/thumbs.js',
  'common/thumbs.css',
  'common/start.js',
  'common/start.css',
  'common/fx.js',
  '2048/',
  '2048/index.html',
  '2048/style.css',
  '2048/js/logic.js',
  '2048/js/ui.js',
  'memory/',
  'memory/index.html',
  'memory/style.css',
  'memory/js/logic.js',
  'memory/js/ui.js',
  'minesweeper/',
  'minesweeper/index.html',
  'minesweeper/style.css',
  'minesweeper/js/logic.js',
  'minesweeper/js/ui.js',
  'guide/',
  'guide/index.html',
  'guide/guide.css',
  'guide/sudoku.html',
  'guide/2048.html',
  'guide/memory.html',
  'guide/minesweeper.html',
  'guide/blocks.html',
  'blocks/',
  'blocks/index.html',
  'blocks/style.css',
  'blocks/js/logic.js',
  'blocks/js/ui.js',
  'snake/',
  'snake/index.html',
  'snake/style.css',
  'snake/js/logic.js',
  'snake/js/ui.js',
  'guide/snake.html',
  'sudoku/',
  'sudoku/index.html',
  'sudoku/style.css',
  'sudoku/js/generator.js',
  'sudoku/js/game.js',
  'sudoku/js/storage.js',
  'sudoku/js/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // 광고 등 다른 사이트의 파일은 건드리지 않는다.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((cached) => cached || (request.mode === 'navigate' ? caches.match('./') : undefined))
        .then((cached) => cached || Response.error())),
  );
});
