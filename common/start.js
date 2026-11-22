// 게임별 시작 화면 공통 동작(모든 게임이 같은 구조).
// 순서: ← 게임 목록 → 제목·설명 → 미리보기 → 이어하기(있을 때) → 오늘의 도전 → 난이도 선택 → 게임 시작 → 내 최고 → 큰 글씨·어두운 화면·도움말
// 난이도는 고르기만 하고 '게임 시작'으로 시작한다. 마지막에 고른 난이도를 기억한다(처음엔 보통).
// 게임 목록의 도장(주소 끝 #daily)으로 들어오면 오늘의 도전을 바로 시작한다.
const MaeilStart = (() => {
  const $ = (id) => document.getElementById(id);

  // options: { id, difficulties: [{ key, label, detail }], defaultKey, bestText(key) → '내 최고 …' | '', onStart(key), onDaily() }
  function setup(options) {
    const { id, difficulties, onStart, onDaily } = options;
    const pickKey = `maeil-game.${id}.pick.v1`;
    const keys = difficulties.map((d) => d.key);
    let selected = MaeilGame.read(pickKey);
    if (!keys.includes(selected)) selected = keys.includes(options.defaultKey || 'medium') ? (options.defaultKey || 'medium') : keys[0];

    const preview = $('preview');
    if (preview && typeof GameThumbs !== 'undefined') preview.innerHTML = GameThumbs.render({ id, name: '' });

    const list = $('difficulty-list');
    list.classList.toggle('four', difficulties.length === 4);
    const buttons = difficulties.map((d) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'st-choice';
      button.setAttribute('role', 'radio');
      button.dataset.key = d.key;
      const mark = document.createElement('span');
      mark.className = 'st-check';
      mark.setAttribute('aria-hidden', 'true');
      button.append(mark, document.createTextNode(d.label));
      button.addEventListener('click', () => select(d.key));
      button.addEventListener('dblclick', () => onStart(d.key)); // PC에서 두 번 누르면 바로 시작
      return button;
    });
    list.replaceChildren(...buttons);

    // 화살표 키로 난이도 옮기기(라디오 버튼처럼)
    list.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = keys[(keys.indexOf(selected) + step + keys.length) % keys.length];
      select(next);
      buttons[keys.indexOf(next)].focus();
    });

    function select(key) {
      selected = key;
      MaeilGame.write(pickKey, key);
      refresh();
    }

    function refresh() {
      buttons.forEach((button) => {
        const on = button.dataset.key === selected;
        button.setAttribute('aria-checked', String(on));
        button.tabIndex = on ? 0 : -1;
      });
      const config = difficulties.find((d) => d.key === selected);
      $('pick-detail').textContent = config.detail;
      const best = options.bestText ? options.bestText(selected) : '';
      $('pick-best').textContent = best;
      $('start-btn').textContent = `${config.label} 게임 시작`;
    }

    $('start-btn').addEventListener('click', () => onStart(selected));
    $('daily-btn').addEventListener('click', onDaily);
    refresh();

    return {
      refresh,
      get selected() { return selected; },
      // 오늘의 도전 카드: done이면 '다시 도전'
      setDaily(info, done) {
        const el = $('daily-info');
        el.textContent = info;
        el.classList.toggle('done', Boolean(done));
        $('daily-go').textContent = done ? '다시 도전 →' : '도전하기 →';
        $('daily-btn').classList.toggle('done', Boolean(done));
      },
    };
  }

  // 게임 목록의 도장으로 들어왔으면(#daily) 오늘의 도전을 바로 시작한다. 주소의 #daily는 지운다(새로고침 때 반복 안 되게).
  function handleDailyLink(onDaily) {
    if (location.hash !== '#daily') return false;
    history.replaceState(null, '', location.pathname + location.search);
    onDaily();
    return true;
  }

  return { setup, handleDailyLink };
})();
