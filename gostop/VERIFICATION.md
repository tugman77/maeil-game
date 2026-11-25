# 맞고 검수 기록 — 2026-11-25

출시 대상은 RULES.md v1. 2026-11-25 그림 교체 전의 출시 검수 기록은 아래와 같다. 현재 그림은 Wikimedia Commons의 한국식 Hwatu 48장(CC BY-SA 4.0)을 원본 그대로 사용하고, 빨간 뒷면만 직접 그렸다. 외부 음원·라이브러리·상용 게임 화면은 사용하지 않는다. 파일별 출처·확인 리비전·수정 여부는 cards/LICENSE.html 및 cards/sources.json에 있다.

- `node --test tests/gostop*.test.js`: 28개 통과(규칙 18, UI 10).
- 손/더미의 같은 달 개수·서로 다른 두 단계 선택을 독립 모델과 256,272건 비교.
- 무작위·세 난이도 AI 대전 3,000판 완주. 매 행동(선택 도중 포함) 48장 중복·유실 없음, 주기적인 합법 행동 재생 검증.
- 1,095일 날짜 시드 재현. 일반 배치·선공은 무작위, 날짜별 배치·선공·더미는 고정.
- 점수 경계: 비삼광/사광/오광, 띠 3종·고도리·열끗·쌍피, 1~6고·피박 0/1/7/8·광박·멍따·고박·흔들기 중첩.
- 뻑/자뻑/3뻑, 두 바닥패 선택의 앞·뒤, 쪽/따닥/쓸 중첩, 마지막 차례 예외, 폭탄과 더미만 사용, 총통/재분배.
- AI 관측 객체에서 상대 손·더미 순서·초기 배치·시드·로그 제외. 상대 손과 더미를 교환·재정렬해도 관측 객체와 난이도별 결정이 같음.
- UI: 선택 전 무변화, 선택 중 저장/이어하기, 컴퓨터 차례 재개/취소, 일시정지/visibility/pagehide/bfcache, 전체 차례 무르기와 더미 복원, 늦은 타이머 무시, 추천, 설정, 기권 확인, 정상 승/패/나가리 단일 기록, 오늘 도전 재현·출석, 손상 저장·저장 차단.
- `node --test tests/*.test.js`: 전체 273개 통과. `node tests/common.test.js`, `node tests/games.test.js`, 스도쿠 game/generator/storage 별도 검사 통과. 스도쿠 60일 fixture 및 공통 난수 원본 보존.
- 실제 Chrome UI(네이티브 조작)로 PC 플레이·패 선택·응수, 다크/밝은 화면, 360px 큰 글씨 세로 배치·하단 버튼, 862×360 가로 회전 시 선택 유지, 새로고침 후 이어하기와 시작 그림을 확인.

## 남은 제한

Safari·Edge·삼성 인터넷과 실제 휴대폰 터치는 직접 검수하지 못했다. 컴퓨터는 공개 정보의 휴리스틱으로 움직이고 모든 난이도에서 스톱을 우선하는 연습 상대다. 전문 기력·암호학적인 조작 방지는 제공하지 않는다. 술잔 피 전환, 보너스패, 첫뻑 추가점, 나가리 다음 판 배수 등은 채택하지 않으며 도움말에 명시했다.


## 화투 그림 교체 검수 — 2026-11-25

- Wikimedia Commons 한국식 Hwatu 48장: Mliu92, 원도안 Louie Mantia. 화투 48개 및 원도안 48개 파일 설명 페이지의 개별 리비전·라이선스 확인. 전부 CC BY-SA 4.0. 파일별 설명 주소·원본 주소·저작자·수정 여부·확인 리비전은 cards/LICENSE.html, sources.json, upstream-sources.json에 보관.
- 앞면은 원본 파일명과 원본 바이트 그대로 사용(SHA-1 전부 일치). 직접 수정하거나 대체 제작한 앞면 없음. 빨간 뒷면 1장은 직접 그렸으며 CC BY-SA 4.0.
- 기존 48개 패 번호·규칙·AI·점수·게임 저장 형식·날짜 시드 유지. 큰 월/종류 글자 띠 제거. 모서리 작은 달 숫자는 도움 표시 설정(기본 켬, 별도 키 저장)으로 전환. 선택 테두리와 ‘선택’ 표시 유지. 시작·목록 그림도 같은 SVG 사용.
- sw.js v33: SVG 49장과 출처 파일 3개 모두 보관. 52개 파일 HTTP 200 및 로컬 원본 일치, SVG 49개 XML 파싱 정상. SVG 총 1,474,903 bytes.
- `node --test tests/gostop*.test.js`: 30개 통과(규칙 18, UI 10, 그림/설정 2).
- `node --test tests/*.test.js`: 전체 294개 통과. `node tests/common.test.js`, `node tests/games.test.js`, `node sudoku/tests/game.test.js`, `node sudoku/tests/generator.test.js`, `node sudoku/tests/storage.test.js` 모두 통과.
- Chrome 실제 UI: 48장 월별 전체 렌더링·전후 비교, PC/360×800 큰 글씨 배치, 밝음/다크 원색 유지, 도움 표시 켬/끔, 선택 강조·내기·컴퓨터 응수·한 차례 무르기·새로고침 후 이어하기 확인. 실제 휴대폰 및 Safari·Edge·삼성 인터넷은 이번에 검수하지 않음.
- `.preview/gostop-cards.html`은 교체 전/후 전환·월별 48장+뒷면·달 숫자·다크·360px 보기 제공. `.preview/`는 커밋 제외.
- 원래 폴더의 gostop-card-art 가지는 실행 환경에서 .git 쓰기가 차단되어 직접 커밋 불가. 같은 작업을 별도 로컬 저장소 /tmp/maeil-gostop-art-review의 gostop-card-art 가지에 커밋하고, 원래 폴더 .preview/gostop-card-art.bundle에 이동 가능한 커밋으로 보관. 원래 폴더는 수정 파일 상태이며 main/원격 push 없음.
