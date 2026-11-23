# 새 게임 index.html 뼈대를 만든다(머리·시작 화면 자리·결과 화면·스크립트). 게임 화면은 GAME_HTML에 넣는다.
# 처음 한 번만 쓰는 도구: 만든 뒤에는 각 index.html을 직접 고치고, 시작 화면은 tools/start_screen.py가 채운다.
import os, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')

def page(gid, title, meta_desc, og_desc, icon_bg, icon_fg, icon_letter, game_html, emoji, result_label):
    icon = (f"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23{icon_bg}'/%3E"
            f"%3Ctext x='50' y='72' font-size='64' text-anchor='middle' fill='%23{icon_fg}' font-family='sans-serif' font-weight='700'%3E{icon_letter}%3C/text%3E%3C/svg%3E")
    return f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="{meta_desc}">
  <meta name="theme-color" content="#f5f3ee">
  <meta property="og:title" content="{title} — 매일게임">
  <meta property="og:description" content="{og_desc}">
  <meta property="og:type" content="website">
  <title>{title} — 매일게임</title>
  <link rel="icon" href="{icon}">
  <link rel="stylesheet" href="../common/base.css">
  <link rel="stylesheet" href="../common/game.css">
  <link rel="stylesheet" href="../common/thumbs.css">
  <link rel="stylesheet" href="../common/start.css">
  <link rel="stylesheet" href="style.css">
  <script>
    try {{
      var s = JSON.parse(localStorage.getItem('maeil-game.settings.v1') || localStorage.getItem('maeil-sudoku.settings.v1') || '{{}}');
      var dark = typeof s.dark === 'boolean' ? s.dark : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      if (s.largeText) document.documentElement.classList.add('large-text');
    }} catch (e) {{}}
  </script>
</head>
<body>
  <!-- 시작 화면 (공통 구조: common/start.css · start.js, tools/start_screen.py로 생성) -->
  <main id="start-screen" class="st"></main>

{game_html}

  <main id="result-screen" class="screen result-screen" hidden>
    <p class="result-emoji" aria-hidden="true">{emoji}</p>
    <h2 id="result-title" class="result-title">게임 끝!</h2>
    <p id="result-sub" class="result-sub"></p>
    <div class="result-card">
      <p class="result-label">{result_label}</p>
      <p id="result-score" class="result-big">0</p>
      <p id="result-detail" class="result-detail"></p>
      <p id="result-best" class="result-best"></p>
      <p id="result-daily" class="result-detail"></p>
    </div>
    <button type="button" id="share-btn" class="primary-btn">결과 공유하기</button>
    <div class="button-pair">
      <button type="button" id="again-btn" class="secondary-btn">새 게임</button>
      <button type="button" id="result-home-btn" class="secondary-btn">처음으로</button>
    </div>
    <aside class="ad-slot" aria-label="광고"></aside>
  </main>

  <script src="../common/core.js"></script>
  <script src="../common/thumbs.js"></script>
  <script src="../common/start.js"></script>
  <script src="../common/fx.js"></script>
  <script src="js/logic.js"></script>
  <script src="js/ui.js"></script>
</body>
</html>
'''

OMOK = '''  <main id="game-screen" class="screen game-screen omok-game" hidden>
    <header class="game-header">
      <button type="button" id="home-btn" class="header-btn">처음으로</button>
      <div class="header-stats">
        <div class="stat-box"><small>내 수</small><b id="move-count">0</b></div>
        <div class="stat-box"><small>무르기</small><b id="undo-count">0</b></div>
      </div>
      <button type="button" id="undo-btn" class="header-btn">무르기</button>
    </header>
    <p id="game-label" class="game-label"></p>
    <p id="game-status" class="omok-status" role="status" aria-live="polite"></p>
    <div id="board-area" class="board-area">
      <div id="board" class="omok-board" role="grid" aria-label="오목 13×13 판"></div>
    </div>
    <button type="button" id="place-btn" class="primary-btn omok-place" disabled>여기에 두기</button>
    <p class="note-text omok-help">칸을 누르면 흐린 돌이 보여요 · 한 번 더 누르거나 [여기에 두기]</p>
  </main>'''

BRICKS = '''  <main id="game-screen" class="screen game-screen bricks-game" hidden>
    <header class="game-header">
      <button type="button" id="home-btn" class="header-btn">처음으로</button>
      <div class="header-stats">
        <div class="stat-box"><small>점수</small><b id="score">0</b></div>
        <div class="stat-box"><small>단계</small><b id="level">1</b></div>
        <div class="stat-box"><small>공</small><b id="lives">3</b></div>
      </div>
      <button type="button" id="pause-btn" class="header-btn">정지</button>
    </header>
    <p id="game-label" class="game-label"></p>
    <div id="board-area" class="board-area">
      <canvas id="canvas" class="bricks-canvas" role="img" aria-label="벽돌깨기 판. 판 위에서 손가락을 좌우로 움직이면 받침대가 따라가요."></canvas>
      <div id="pause-overlay" class="pause-overlay" hidden>
        <p id="pause-title" class="pause-title">일시정지</p>
        <p id="pause-note" class="note-text">하던 판은 자동으로 저장돼요</p>
        <button type="button" id="resume-btn" class="primary-btn">계속하기</button>
      </div>
    </div>
    <p id="game-status" class="note-text bricks-help" role="status" aria-live="polite">판을 누르면 공이 출발해요 · 손가락을 좌우로 움직여 받아 내세요</p>
  </main>'''

RUNNER = '''  <main id="game-screen" class="screen game-screen runner-game" hidden>
    <header class="game-header">
      <button type="button" id="home-btn" class="header-btn">처음으로</button>
      <div class="header-stats">
        <div class="stat-box"><small>거리</small><b id="distance">0m</b></div>
        <div class="stat-box"><small>목숨</small><b id="lives">♥♥♥</b></div>
      </div>
      <button type="button" id="pause-btn" class="header-btn">정지</button>
    </header>
    <p id="game-label" class="game-label"></p>
    <div id="board-area" class="board-area runner-area">
      <canvas id="canvas" class="runner-canvas" role="img" aria-label="점프 러너. 화면을 누르면 점프해요."></canvas>
      <div id="pause-overlay" class="pause-overlay" hidden>
        <p id="pause-title" class="pause-title">준비됐나요?</p>
        <p id="pause-note" class="note-text">화면을 누르면 점프해요</p>
        <button type="button" id="resume-btn" class="primary-btn">출발하기</button>
      </div>
    </div>
    <button type="button" id="jump-btn" class="primary-btn runner-jump">점프!</button>
    <p id="game-status" class="note-text runner-help" role="status" aria-live="polite">화면 아무 곳이나 눌러도 점프 · PC는 스페이스바</p>
  </main>'''

REVERSI = '''  <main id="game-screen" class="screen game-screen reversi-game" hidden>
    <header class="game-header">
      <button type="button" id="home-btn" class="header-btn">처음으로</button>
      <div class="header-stats">
        <div id="black-stat" class="stat-box"><small>나 · 흑</small><b id="black-count">2</b></div>
        <div id="white-stat" class="stat-box"><small>컴퓨터 · 백</small><b id="white-count">2</b></div>
      </div>
      <button type="button" id="undo-btn" class="header-btn">무르기</button>
    </header>
    <p id="game-label" class="game-label"></p>
    <p id="game-status" class="reversi-status" role="status" aria-live="polite"></p>
    <div id="board" class="reversi-board" role="group" aria-label="리버시 8×8 판. 방향키로 이동, Enter로 선택하고 한 번 더 누르면 놓기."></div>
    <div class="reversi-actions">
      <button type="button" id="place-btn" class="primary-btn" disabled>둘 곳을 선택하세요</button>
      <button type="button" id="hint-btn" class="secondary-btn">추천 수 보기</button>
      <button type="button" id="clear-pick-btn" class="secondary-btn" disabled>선택 취소</button>
    </div>
    <p id="move-detail" class="reversi-help">밝은 원이 있는 칸에 둘 수 있어요</p>
    <p class="reversi-help">제한 시간 없음 · 무르기 횟수 제한 없음 · <a href="../guide/reversi.html">게임 방법</a></p>
  </main>'''

SPECS = {
  'reversi': ('리버시', '설치 없이 바로 하는 리버시. 컴퓨터와 돌을 뒤집어 마지막에 더 많이 남기세요. 난이도 3단계, 무르기·추천 수·이어하기, 오늘의 도전.', '컴퓨터와 돌 뒤집기 한 판. 시간 제한 없이 천천히 생각하세요.', '245b40', 'fff5c0', 'R', REVERSI, '⚫', '내 돌 : 컴퓨터 돌'),
  'omok': ('오목', '설치 없이 바로 하는 오목. 컴퓨터와 13×13 판에서 다섯 알을 먼저 이어 보세요. 쉬움·보통·어려움, 무르기, 오늘의 도전.', '컴퓨터와 두는 오목 한 판. 오늘의 도전에서 이겨 보세요!', '7a5a2e', 'ffffff', '五', OMOK, '⚫', '이긴 수'),
  'bricks': ('벽돌깨기', '설치 없이 바로 하는 벽돌깨기. 받침대로 공을 튕겨 벽돌을 모두 깨세요. 손가락 하나로 조작, 오늘의 도전 판.', '공을 튕겨 벽돌을 깨는 한 판. 오늘의 도전 판을 깨 보세요!', '3b5bab', 'ffffff', 'B', BRICKS, '🧱', '점수'),
  'runner': ('점프 러너', '설치 없이 바로 하는 점프 러너. 화면을 눌러 장애물을 뛰어넘고 멀리 달리세요. 오늘의 도전은 500m.', '누르면 점프! 장애물을 넘어 얼마나 멀리 갈 수 있을까요?', 'e0a21a', 'ffffff', 'J', RUNNER, '🐥', '달린 거리'),
}
for gid, (title, md, og, bg, fg, letter, game_html, emoji, label) in SPECS.items():
    os.makedirs(os.path.join(ROOT, gid, 'js'), exist_ok=True)
    p = os.path.join(ROOT, gid, 'index.html')
    if os.path.exists(p) and '--force' not in sys.argv:
        print('skip', gid); continue
    open(p, 'w', encoding='utf-8').write(page(gid, title, md, og, bg, fg, letter, game_html, emoji, label))
    print('ok', gid)
