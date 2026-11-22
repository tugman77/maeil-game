# 매일게임 — 프로젝트 지침

간단 게임 모음 사이트. 기획: `../게임모음_PRD.md`(v2, 2026-11-22). 매일 스도쿠(`../스도쿠게임`)를 `sudoku/`로 옮겨 시작했다.

## 기술 규칙
- HTML + CSS + 순수 JavaScript만 (프레임워크·빌드 도구·외부 라이브러리 금지). 저장은 localStorage, 서버·로그인 없음
- 화면 문구는 한국어. 40~60대 대상: 큰 글씨, 누르는 곳 최소 44px, 높은 색 대비, 세로 화면·한 손 조작 우선
- 지원: 크롬·사파리·엣지·삼성 인터넷 최신판, 화면 폭 360px 이상
- 게임 화면(조작 버튼 근처)에는 광고를 두지 않는다. 광고 자리는 `.ad-slot`(비어 있으면 숨김) — 선택·결과 화면만

## 구조
```
index.html · hub.js · hub.css   게임 선택 화면 (games.json을 읽어 카드 생성)
games.json                      게임 목록. status "ready"면 공개, "soon"이면 '곧 나와요'
common/core.js                  공통: 시드 난수·한국 날짜·설정·매일 도전/연속 출석·요약·공유·오프라인 등록 (전역 MaeilGame)
common/base.css                 공통 색상 토큰(밝고 차분한 게임 라운지: 회백색+짙은 초록)·버튼·안내 메시지. sudoku/style.css도 같은 값
common/thumbs.js · thumbs.css   게임 썸네일(SVG)과 색. 새 게임은 160×120으로 하나 그리고 .thumb-게임id 색을 정한다
common/start.js · start.css     게임별 시작 화면 공통 틀(목록 링크→제목→미리보기→이어하기→오늘의 도전→난이도→게임 시작→내 최고→큰 글씨·어두운 화면·도움말).
                                마크업은 tools/start_screen.py가 만든다(게임 추가 시 GAMES에 한 줄). #daily로 들어오면 오늘의 도전 바로 시작
sw.js                           사이트 전체 공용 오프라인 보관 (파일 추가 시 FILES에도 추가)
sudoku/                         스도쿠 (자체 CLAUDE.md 규칙은 ../스도쿠게임/CLAUDE.md 참고)
tests/                          node tests/common.test.js · node tests/games.test.js
2048/ · memory/                 각 js/logic.js(규칙, node 검사 가능) + js/ui.js(화면)
```

## 새 게임 붙이는 법
1. `게임id/index.html`에서 `../common/base.css`, `../common/core.js`를 불러온다. 맨 위에 `<a href="../">← 매일게임</a>`.
2. 매일 도전 판은 `MaeilGame.dailyRandom('게임id')`(한국 날짜 기준 시드)로 만든다. 판이 진행되며 난수를 계속 쓰는 게임(2048·블록 쌓기)은 `randomState`/`nextRandom`으로 상태를 게임 저장에 넣는다.
   화면 틀은 `../common/game.css`(시작·게임·결과 화면, `.header-btn.armed` 두 번 눌러 실행). 2048·memory가 본보기.
3. 매일 도전을 끝내면 `MaeilGame.recordDaily('게임id')`, 기록이 바뀌면 `MaeilGame.setSummary('게임id', '최고 1,024점')`(최고 기록만 — '오늘 완료'는 허브가 출석으로 표시), 시작하면 `markPlayed('게임id')`.
   games.json에 `short`(도장판 짧은 이름)도 넣는다.
4. 저장 키는 `maeil-game.게임id.*` 형식.
5. `guide/게임id.html` 설명·요령 글을 쓴다(광고 승인용, 건강 효과 같은 확인 안 되는 주장 금지). 글 틀은 `guide/*.html` 복사.
6. `games.json`의 status를 `ready`로, `sw.js` FILES에 파일 추가 → `node tests/common.test.js` 통과 확인(설명 페이지·sw 누락도 잡음).

## 지켜야 할 것
- **스도쿠 오늘의 문제 보존**: `sudoku/js/generator.js`와 `common/core.js`의 `createSeededRandom`을 바꾸지 않는다. `tests/fixtures/sudoku-daily.json`(옮기기 전 60일치)과 비교 검사가 있다.
- 기존 매일 스도쿠 기록 키(`maeil-sudoku.*`)는 그대로 읽는다. 공통 설정·출석은 처음에 매일 스도쿠 값을 이어받는다.
- 매일 도전·연속 출석은 **한국 시간 자정** 기준(`MaeilGame.todayKey()`).
- 도메인은 게임을 어느 정도 만든 뒤 정한다. 옮길 때 '기록 옮기기'(옛 주소에서 `#` 뒷부분으로 기록 전달) 필수 — localStorage는 주소별이라 그냥 옮기면 기록·출석이 사라진다.

## 배포 (예정)
저장소 `tugman77/maeil-game` → GitHub Pages(main 루트) → `https://tugman77.github.io/maeil-game/`.
같은 `tugman77.github.io`라 매일 스도쿠 기록을 그대로 이어받는다. 옛 주소 `maeil-sudoku`는 4주차에 넘김 페이지로 바꾸고, 총괄 아침 안내·`게임점검.js` 주소도 교체.

## 진행
- [x] 1주차: 공통 모듈·허브·스도쿠 옮기기 (2026-11-22)
- [x] 2주차: 2048, 카드 짝맞추기 (2026-11-22)
- [x] 3주차: 지뢰찾기([열기/깃발] 전환 버튼, 매일 도전은 한 구역 열고 시작), 게임 설명 페이지 `guide/` (2026-11-22)
- [x] 디자인 개편: 게임 라운지(카드 2~4열·썸네일·도장판) (2026-11-22, ChatGPT 제안서 + 검토 의견)
- [x] 4주차: 블록 쌓기(버튼 줄 ◀↻▶▼⤓ + 판 위 밀기), 개인정보처리방침·소개 (2026-11-22)
- [x] 시작 화면 통일·메인 정돈(ChatGPT 2차 제안 + 검토: 오늘의 도전을 게임 시작 위에, 이어하기 유지) (2026-11-22)
- [ ] 옛 주소 maeil-sudoku 넘김 페이지 + 채널등록부·총괄 아침 안내·시너지 링크 교체 (대표님 확인 후)
- 설명 글은 `tools/make_guides.py`를 고쳐 다시 만든다. 개인정보처리방침은 통계·광고 도입 **전에** 고친다(4항)
