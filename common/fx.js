// 매일게임 공통 연출: 효과음·진동·숫자 올라가기·색종이.
// - 효과음은 음원 파일 없이 브라우저가 직접 만든다(Web Audio). 짧고(0.3초 안쪽) 작게.
// - 처음에는 꺼져 있고, 시작 화면에서 한 번만 "효과음을 켤까요?"를 묻는다(settings.soundAsked).
// - 진동(안드로이드)은 효과음과 같은 설정을 따른다. 아이폰 브라우저는 진동을 지원하지 않는다.
// - 휴대폰 '동작 줄이기'가 켜져 있으면 숫자 올라가기·색종이를 생략한다.
const MaeilFx = (() => {
  let ctx = null;
  let master = null;

  const soundOn = () => Boolean(MaeilGame.loadSettings().sound);
  const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // 휴대폰은 사용자가 화면을 누른 뒤에야 소리를 낼 수 있다 → 첫 누름에 소리 장치를 깨운다.
  if (typeof document !== 'undefined') {
    const unlock = () => { if (soundOn()) audio(); };
    document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    document.addEventListener('keydown', unlock, { capture: true });
  }

  // 음 하나: 주파수 f(→f2로 미끄러짐), 길이 dur초, 파형 type, 크기 vol, delay초 뒤
  function tone({ f = 440, f2 = null, dur = 0.08, type = 'sine', vol = 0.12, delay = 0 }) {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 잡음(쓱·퍽 소리): 낮은 소리만 남기는 거르개를 지나게 한다
  function noise({ dur = 0.06, vol = 0.05, cutoff = 1500, delay = 0 }) {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const length = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ac.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }

  const notes = (list, { dur = 0.11, type = 'sine', vol = 0.1, gap = 0.08 } = {}) => {
    list.forEach((f, i) => tone({ f, dur: i === list.length - 1 ? dur * 2 : dur, type, vol, delay: i * gap }));
  };

  // 소리 목록 (게임에서 MaeilFx.play('merge', { level: 3 }) 처럼 부른다)
  const SOUNDS = {
    tap: () => tone({ f: 880, dur: 0.035, type: 'triangle', vol: 0.05 }),
    place: () => tone({ f: 560, f2: 500, dur: 0.06, type: 'triangle', vol: 0.09 }),
    slide: () => noise({ dur: 0.07, vol: 0.035, cutoff: 1400 }),
    merge: ({ level = 1 } = {}) => {
      const f = 392 * 2 ** (Math.min(level - 1, 16) / 12);
      tone({ f, dur: 0.1, vol: 0.11 });
      tone({ f: f * 2, dur: 0.06, vol: 0.03 });
    },
    flip: () => noise({ dur: 0.045, vol: 0.06, cutoff: 3200 }),
    match: () => notes([660, 880], { gap: 0.08, vol: 0.1 }),
    miss: () => tone({ f: 240, f2: 180, dur: 0.16, vol: 0.09 }),
    open: () => tone({ f: 1250, dur: 0.025, type: 'triangle', vol: 0.045 }),
    flag: () => tone({ f: 740, f2: 980, dur: 0.06, type: 'triangle', vol: 0.07 }),
    unflag: () => tone({ f: 740, f2: 520, dur: 0.06, type: 'triangle', vol: 0.06 }),
    boom: () => { noise({ dur: 0.35, vol: 0.22, cutoff: 420 }); tone({ f: 120, f2: 50, dur: 0.35, vol: 0.16 }); },
    rotate: () => tone({ f: 660, dur: 0.03, type: 'triangle', vol: 0.045 }),
    lock: () => tone({ f: 200, f2: 150, dur: 0.06, type: 'triangle', vol: 0.1 }),
    thud: () => { tone({ f: 150, f2: 80, dur: 0.12, vol: 0.16 }); noise({ dur: 0.05, vol: 0.06, cutoff: 600 }); },
    clear: ({ lines = 1 } = {}) => notes([523, 659, 784, 1047].slice(0, Math.max(1, lines)), { gap: 0.06, vol: 0.09 }),
    levelup: () => notes([523, 659, 784], { gap: 0.07, vol: 0.09 }),
    wave: () => notes([784, 988, 1175], { gap: 0.045, dur: 0.06, vol: 0.06 }),
    error: () => tone({ f: 200, dur: 0.12, type: 'square', vol: 0.035 }),
    hint: () => notes([880, 1175], { gap: 0.07, vol: 0.07 }),
    success: () => notes([523, 659, 784, 1047], { gap: 0.09, dur: 0.12, vol: 0.1 }),
    record: () => { notes([523, 659, 784, 1047], { gap: 0.09, dur: 0.12, vol: 0.1 }); notes([1319, 1568], { gap: 0.06, vol: 0.05 }); },
    over: () => notes([392, 330, 262], { gap: 0.14, dur: 0.14, vol: 0.08, type: 'triangle' }),
    on: () => notes([659, 988], { gap: 0.07, vol: 0.08 }),
  };

  function play(name, options) {
    if (!soundOn() || !SOUNDS[name]) return;
    try { SOUNDS[name](options); } catch { /* 소리 장치가 없으면 조용히 넘어간다 */ }
  }

  // 진동(밀리초 또는 [진동, 쉼, 진동])
  function buzz(pattern = 15) {
    if (!soundOn() || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch { /* 지원하지 않으면 무시 */ }
  }

  // 숫자 올라가기: el의 글자를 0 → to로 (format으로 글자 모양 결정)
  function countUp(el, to, format = String, ms = 650) {
    if (!el) return;
    if (reducedMotion() || to <= 0) {
      el.textContent = format(to);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      el.textContent = format(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = format(0);
    requestAnimationFrame(step);
  }

  // 색종이 (새 기록일 때만 짧게)
  function confetti() {
    if (reducedMotion() || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100';
    document.body.appendChild(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width = window.innerWidth * dpr;
    const h = canvas.height = window.innerHeight * dpr;
    const g = canvas.getContext('2d');
    const colors = ['#1e6b48', '#5bbf8c', '#f2b01e', '#e0674f', '#7d5cc6', '#3b6fc4'];
    const parts = Array.from({ length: 90 }, () => ({
      x: w * (0.2 + Math.random() * 0.6),
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 14 * dpr,
      vy: (-8 - Math.random() * 10) * dpr,
      r: (4 + Math.random() * 5) * dpr,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    const frame = (now) => {
      const t = now - start;
      g.clearRect(0, 0, w, h);
      parts.forEach((p) => {
        p.vy += 0.45 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        g.save();
        g.globalAlpha = Math.max(0, 1 - t / 1600);
        g.translate(p.x, p.y);
        g.rotate(p.a);
        g.fillStyle = p.c;
        g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        g.restore();
      });
      if (t < 1600) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  }

  // 요소에 잠깐 클래스를 붙였다 뗀다(흔들기·톡 튀기 같은 짧은 움직임을 다시 재생할 때)
  function pulse(el, cls, ms = 300) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  return { play, buzz, countUp, confetti, pulse, soundOn };
})();
