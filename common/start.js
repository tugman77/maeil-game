// 게임별 시작 화면 공통 동작(모든 게임이 같은 구조).
// 순서: ← 게임 목록 → 제목·설명 → 대표 카드(큰 그림 + 오늘의 도전 띠) → 이어하기(있을 때) → 난이도(모든 게임 한 줄) → 게임 시작 → 내 최고
//       → (오늘의 도전을 끝낸 날: 작은 '다시 도전' 줄) → 큰 글씨·어두운 화면·소리·도움말
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
    if (preview && typeof GameThumbs !== 'undefined') {
      preview.innerHTML = GameThumbs.render({ id, name: '' });
      fitPreview(preview);
    }

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

    // 이어하기 칸이 보이면 그림을 줄인다(.has-continue). 게임마다 따로 붙이지 않아도 되게 여기서 지켜본다.
    const continueWrap = $('continue-wrap');
    const screen = $('start-screen');
    if (continueWrap && screen && typeof MutationObserver === 'function') {
      const sync = () => screen.classList.toggle('has-continue', !continueWrap.hidden);
      new MutationObserver(sync).observe(continueWrap, { attributes: true, attributeFilter: ['hidden'] });
      sync();
    }

    $('start-btn').addEventListener('click', () => onStart(selected));
    $('daily-btn').addEventListener('click', onDaily);
    setupSound();
    refresh();

    return {
      refresh,
      get selected() { return selected; },
      // 오늘의 도전: 아직이면 대표 카드(그림 아래 띠), 끝냈으면 '게임 시작' 아래로 작게 내려 '다시 도전'
      setDaily(info, done) {
        const el = $('daily-info');
        el.textContent = info;
        el.classList.toggle('done', Boolean(done));
        $('daily-go').textContent = done ? '다시 도전 →' : '도전하기 →';
        const btn = $('daily-btn');
        btn.classList.toggle('done', Boolean(done));
        const hero = $('hero');
        const slot = $('daily-done-slot');
        if (hero && slot && typeof slot.append === 'function') {
          const target = done ? slot : hero;
          if (btn.parentElement !== target) target.append(btn);
          hero.classList?.toggle('no-daily', Boolean(done));
        }
      },
    };
  }

  // 썸네일은 목록 카드용이라 160×120 안에 여백이 있다. 시작 화면에서는 그림 둘레만 남기고 잘라 칸을 꽉 채운다.
  // 화면에 보일 때(크기가 생길 때) 한 번 잰다 — #daily로 바로 게임에 들어가 시작 화면이 숨어 있으면 나중에.
  function fitPreview(preview) {
    const svg = preview.querySelector('svg');
    if (!svg || typeof svg.getBBox !== 'function') return;
    const fit = () => {
      try {
        const box = svg.getBBox();
        if (!(box.width > 0 && box.height > 0)) return false;
        const m = 5; // 테두리 굵기·그림자 여유
        svg.setAttribute('viewBox', `${box.x - m} ${box.y - m} ${box.width + m * 2} ${box.height + m * 2}`);
        return true;
      } catch { return false; }
    };
    if (fit() || typeof ResizeObserver !== 'function') return;
    const watch = new ResizeObserver(() => { if (fit()) watch.disconnect(); });
    watch.observe(preview);
  }

  // 효과음: 처음 한 번 "효과음을 켤까요?"를 묻고(어느 게임에서든 한 번 답하면 끝), 소리 버튼으로 켜고 끈다.
  function setupSound() {
    const ask = $('sound-ask');
    const syncButtons = () => {
      const on = Boolean(MaeilGame.loadSettings().sound);
      document.querySelectorAll('.sound-toggle').forEach((b) => b.setAttribute('aria-pressed', String(on)));
    };
    const answer = (on) => {
      MaeilGame.saveSettings({ sound: on, soundAsked: true });
      if (ask) ask.hidden = true;
      syncButtons();
      if (on && typeof MaeilFx !== 'undefined') MaeilFx.play('on');
    };
    if (ask) {
      ask.hidden = Boolean(MaeilGame.loadSettings().soundAsked);
      $('sound-yes').addEventListener('click', () => answer(true));
      $('sound-no').addEventListener('click', () => answer(false));
    }
    document.querySelectorAll('.sound-toggle').forEach((button) => {
      button.addEventListener('click', () => answer(!MaeilGame.loadSettings().sound));
    });
    syncButtons();
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
