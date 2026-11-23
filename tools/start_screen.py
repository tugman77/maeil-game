# 게임별 시작 화면 HTML(공통 구조)을 만든다. 각 게임 index.html의 <!-- 시작 화면 --> ~ </main> 부분을 바꾼다.
# 실행: python3 tools/start_screen.py  (게임을 추가하면 GAMES에 한 줄 추가)
import re, sys, os
ROOT = os.path.join(os.path.dirname(__file__), '..')

ICON_TEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18 9 5h1.6l5 13M6 13.5h7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 18v-5.2M14 12.8h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
ICON_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
ICON_HELP = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.2" fill="currentColor"/></svg>'

def block(gid, title, desc, stats=False):
    stats_btn = ' <button type="button" id="stats-btn" class="st-link">기록 보기</button>' if stats else ''
    return f'''<!-- 시작 화면 (공통 구조: common/start.css · start.js, tools/start_screen.py로 생성) -->
  <main id="start-screen" class="st">
    <a href="../" class="st-back">← 게임 목록</a>
    <header>
      <h1 class="st-title">{title}</h1>
      <p class="st-desc">{desc}</p>
    </header>
    <div class="st-preview thumb-{gid}" id="preview" aria-hidden="true"></div>

    <div class="st-ask" id="sound-ask" hidden>
      <span>{ICON_SOUND}효과음을 켤까요?</span>
      <button type="button" id="sound-yes" class="st-ask-yes">켜기</button>
      <button type="button" id="sound-no" class="st-ask-no">괜찮아요</button>
    </div>

    <div id="continue-wrap" hidden>
      <button type="button" id="continue-btn" class="st-continue">▶ 이어하기<small id="continue-info"></small></button>
      <p class="st-note">새 게임을 시작하면 하던 게임은 사라져요</p>
    </div>

    <button type="button" id="daily-btn" class="st-daily">
      <span class="st-daily-text"><b>오늘의 도전</b><small id="daily-info"></small></span>
      <span class="st-daily-go" id="daily-go">도전하기 →</span>
    </button>

    <section class="st-pick" aria-labelledby="pick-label">
      <h2 class="st-label" id="pick-label">난이도</h2>
      <div class="st-choices" id="difficulty-list" role="radiogroup" aria-labelledby="pick-label"></div>
      <p class="st-detail" id="pick-detail"></p>
      <button type="button" id="start-btn" class="st-start">게임 시작</button>
      <p class="st-best"><span id="pick-best"></span>{stats_btn}</p>
    </section>

    <div class="st-tools">
      <button type="button" class="st-tool large-text-toggle" aria-pressed="false">{ICON_TEXT}큰 글씨</button>
      <button type="button" class="st-tool dark-toggle" aria-pressed="false">{ICON_MOON}어두운 화면</button>
      <button type="button" class="st-tool sound-toggle" aria-pressed="false">{ICON_SOUND}소리</button>
      <a class="st-tool" href="../guide/{gid}.html">{ICON_HELP}도움말</a>
    </div>

    <!-- 광고 자리: 비어 있으면 화면에 보이지 않습니다. 게임 화면에는 두지 않습니다. -->
    <aside class="ad-slot" aria-label="광고"></aside>
  </main>'''

GAMES = [
  ('2048', '2048', '같은 숫자를 밀어 합쳐 2048을 만들어 보세요.', False),
  ('memory', '카드 짝맞추기', '카드를 두 장씩 뒤집어 같은 그림을 찾는 기억력 게임이에요.', False),
  ('minesweeper', '지뢰찾기', '숫자는 주변 8칸의 지뢰 수예요. 지뢰 없는 칸을 모두 여세요.', False),
  ('blocks', '블록 쌓기', '떨어지는 블록으로 가로줄을 빈틈없이 채워 없애세요.', False),
  ('snake', '스네이크', '먹이를 먹으며 길게 자라요. 벽과 자기 몸을 피해 방향을 바꾸세요.', False),
  ('sudoku', '스도쿠', '가로줄·세로줄·3×3 칸에 1~9를 한 번씩 채우는 숫자 퍼즐이에요.', True),
]

for gid, title, desc, stats in GAMES:
    p = os.path.join(ROOT, gid, 'index.html')
    s = open(p, encoding='utf-8').read()
    start = s.index('<!-- 시작 화면')
    end = s.index('</main>', start) + len('</main>')
    s = s[:start] + block(gid, title, desc, stats) + s[end:]
    # 공통 CSS·JS 연결 (한 번만)
    if 'href="../common/start.css"' not in s:
        s = s.replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="../common/thumbs.css">\n  <link rel="stylesheet" href="../common/start.css">\n  <link rel="stylesheet" href="style.css">', 1)
    if 'src="../common/start.js"' not in s:
        s = s.replace('<script src="../common/core.js"></script>', '<script src="../common/core.js"></script>\n  <script src="../common/thumbs.js"></script>\n  <script src="../common/start.js"></script>', 1)
    if 'src="../common/fx.js"' not in s:
        s = s.replace('<script src="../common/start.js"></script>', '<script src="../common/start.js"></script>\n  <script src="../common/fx.js"></script>', 1)
    open(p, 'w', encoding='utf-8').write(s)
    print('ok', gid)
