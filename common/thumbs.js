// 게임 썸네일: 이모지 대신 게임의 특징(숫자판·타일·카드·지뢰판·블록)을 코드로 그린 SVG.
// 이미지 파일이 없어 가볍고, 색은 hub.css의 .th-* 클래스가 정해 어두운 화면에서도 맞게 바뀐다.
// 새 게임을 추가하면 여기에 같은 크기(160×120)로 하나 그린다. 없으면 이름 첫 글자로 대신한다.
const GameThumbs = (() => {
  const svg = (body) => `<svg viewBox="0 0 160 120" aria-hidden="true" focusable="false">${body}</svg>`;

  // 스도쿠: 3×3 판에 숫자 몇 개
  function sudoku() {
    const digits = { 0: 5, 2: 3, 4: 7, 6: 1, 8: 9, 5: 4 };
    let cells = '';
    for (let i = 0; i < 9; i++) {
      const x = 35 + (i % 3) * 30;
      const y = 15 + Math.floor(i / 3) * 30;
      if (i === 4) cells += `<rect x="${x}" y="${y}" width="30" height="30" class="th-hl"/>`;
      if (digits[i]) cells += `<text x="${x + 15}" y="${y + 22}" class="th-digit${i === 4 ? ' th-user' : ''}">${digits[i]}</text>`;
    }
    const lines = [1, 2].map((k) => `<line x1="${35 + k * 30}" y1="15" x2="${35 + k * 30}" y2="105" class="th-line"/><line x1="35" y1="${15 + k * 30}" x2="125" y2="${15 + k * 30}" class="th-line"/>`).join('');
    return svg(`<rect x="35" y="15" width="90" height="90" rx="4" class="th-paper"/>${cells}${lines}<rect x="35" y="15" width="90" height="90" rx="4" class="th-frame"/>`);
  }

  // 2048: 2×2 타일
  function game2048() {
    const tiles = [[2, '#eee4da', '#5b5148'], [8, '#f2b179', '#fff'], [64, '#f65e3b', '#fff'], [2048, '#edc22e', '#fff']];
    const body = tiles.map(([n, bg, fg], i) => {
      const x = 38 + (i % 2) * 44;
      const y = 16 + Math.floor(i / 2) * 44;
      const size = n >= 1000 ? 13 : n >= 10 ? 18 : 22;
      return `<rect x="${x}" y="${y}" width="40" height="40" rx="6" fill="${bg}"/><text x="${x + 20}" y="${y + 20 + size * 0.36}" font-size="${size}" fill="${fg}" class="th-num">${n}</text>`;
    }).join('');
    return svg(`<rect x="34" y="12" width="92" height="92" rx="10" class="th-2048-board"/>${body}`);
  }

  // 카드 짝맞추기: 뒷면 두 장 + 앞면(별) 한 장
  function memory() {
    const back = (x, y, r) => `<g transform="rotate(${r} ${x + 22} ${y + 30})"><rect x="${x}" y="${y}" width="44" height="60" rx="7" class="th-card-back"/><rect x="${x + 6}" y="${y + 6}" width="32" height="48" rx="4" class="th-card-inner"/></g>`;
    const star = 'M80 44 l5.3 10.8 11.9 1.7 -8.6 8.4 2 11.8 -10.6 -5.6 -10.6 5.6 2 -11.8 -8.6 -8.4 11.9 -1.7z';
    return svg(`${back(22, 34, -10)}${back(94, 34, 10)}<rect x="58" y="28" width="44" height="60" rx="7" class="th-card-face"/><path d="${star}" class="th-star"/>`);
  }

  // 지뢰찾기: 4×3 판, 숫자·깃발
  function minesweeper() {
    const open = { 0: '', 1: '1', 4: '1', 5: '2', 8: '1' };
    const colors = { 1: 'th-n1', 2: 'th-n2' };
    let body = '';
    for (let i = 0; i < 12; i++) {
      const x = 28 + (i % 4) * 26;
      const y = 22 + Math.floor(i / 4) * 26;
      const isOpen = i in open;
      body += `<rect x="${x}" y="${y}" width="26" height="26" class="${isOpen ? 'th-ms-open' : 'th-ms-closed'}"/>`;
      if (open[i]) body += `<text x="${x + 13}" y="${y + 19}" class="th-ms-num ${colors[open[i]]}">${open[i]}</text>`;
    }
    // 깃발 (i = 6)
    body += '<line x1="87" y1="53" x2="87" y2="68" class="th-pole"/><path d="M87 53 l11 4 -11 4z" class="th-flag"/>';
    return svg(`<rect x="26" y="20" width="108" height="82" rx="4" class="th-ms-frame"/>${body}`);
  }

  // 블록 쌓기: 떨어지는 조각과 쌓인 줄
  function blocks() {
    const sq = (x, y, cls) => `<rect x="${x}" y="${y}" width="16" height="16" rx="3" class="${cls}"/>`;
    const at = (cells, cls) => cells.map(([c, r]) => sq(36 + c * 18, 12 + r * 18, cls)).join('');
    return svg(
      `<rect x="34" y="10" width="92" height="98" rx="6" class="th-well"/>`
      + at([[1, 0], [2, 0], [3, 0], [2, 1]], 'th-b1')
      + at([[0, 4], [0, 3], [1, 4], [2, 4], [4, 4], [3, 3], [4, 3]], 'th-b2')
      + at([[1, 3], [2, 3]], 'th-b3'),
    );
  }

  const DRAW = { sudoku, 2048: game2048, memory, minesweeper, blocks };

  function render(game) {
    if (DRAW[game.id]) return DRAW[game.id]();
    return svg(`<text x="80" y="76" class="th-fallback">${game.name.slice(0, 1)}</text>`);
  }

  return { render };
})();
