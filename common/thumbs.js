// 게임 썸네일: 이모지 대신 게임의 특징(숫자판·타일·카드·지뢰판·블록)을 코드로 그린 SVG.
// 색은 hub.css의 .th-* 클래스가 정한다. 맞고는 실제 게임과 같은 공개 라이선스 SVG를 사용한다.
// 새 게임을 추가하면 160×120 좌표로 그리고 FRAMES에 그림 둘레 범위를 정한다. 없으면 이름 첫 글자로 대신한다.
const GameThumbs = (() => {
  const hwatuRoot = new URL('../gostop/cards/', document.currentScript.src).href;
  // 원래 160×120 그림에서 빈 여백만 줄인다. 테두리·회전 카드 둘레에 4단위 여유를 둔다.
  // 목록·오늘의 추천·시작 화면이 같은 범위를 써서 숨겨진 화면에서도 크기가 일정하다.
  const FRAMES = {
    'sudoku': '31 11 98 98',
    '2048': '30 8 100 100',
    'memory': '13.1 24 133.8 77.4',
    'minesweeper': '22 16 116 90',
    'blocks': '30 6 100 106',
    'snake': '20 10 121 104',
    'omok': '20 3 121 114',
    'bricks': '20 4 120 112',
    'runner': '10 4 140 112',
    'reversi': '25 5 110 110',
    'sichuan': '14 3 132 115',
    'number-baseball': '13 7 134 107',
    'freecell': '11 4 138 112',
    'klondike': '9 4 142 113',
    'initial-quiz': '11 5 138 110',
    'proverb-quiz': '10 5 140 110',
    'hanja': '16 3 128 114',
    'janggi': '31 2 98 116',
    'go': '24 4 112 112',
    'gostop': '8 6 144 108',
  };
  const svg = (id, body) => `<svg viewBox="${FRAMES[id] || '0 0 160 120'}" aria-hidden="true" focusable="false">${body}</svg>`;

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
    return svg('sudoku', `<rect x="35" y="15" width="90" height="90" rx="4" class="th-paper"/>${cells}${lines}<rect x="35" y="15" width="90" height="90" rx="4" class="th-frame"/>`);
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
    return svg('2048', `<rect x="34" y="12" width="92" height="92" rx="10" class="th-2048-board"/>${body}`);
  }

  // 카드 짝맞추기: 뒷면 두 장 + 앞면(별) 한 장
  function memory() {
    const back = (x, y, r) => `<g transform="rotate(${r} ${x + 22} ${y + 30})"><rect x="${x}" y="${y}" width="44" height="60" rx="7" class="th-card-back"/><rect x="${x + 6}" y="${y + 6}" width="32" height="48" rx="4" class="th-card-inner"/></g>`;
    const star = 'M80 44 l5.3 10.8 11.9 1.7 -8.6 8.4 2 11.8 -10.6 -5.6 -10.6 5.6 2 -11.8 -8.6 -8.4 11.9 -1.7z';
    return svg('memory', `${back(22, 34, -10)}${back(94, 34, 10)}<rect x="58" y="28" width="44" height="60" rx="7" class="th-card-face"/><path d="${star}" class="th-star"/>`);
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
    return svg('minesweeper', `<rect x="26" y="20" width="108" height="82" rx="4" class="th-ms-frame"/>${body}`);
  }

  // 블록 쌓기: 떨어지는 조각과 쌓인 줄
  function blocks() {
    const sq = (x, y, cls) => `<rect x="${x}" y="${y}" width="16" height="16" rx="3" class="${cls}"/>`;
    const at = (cells, cls) => cells.map(([c, r]) => sq(36 + c * 18, 12 + r * 18, cls)).join('');
    return svg('blocks',
      `<rect x="34" y="10" width="92" height="98" rx="6" class="th-well"/>`
      + at([[1, 0], [2, 0], [3, 0], [2, 1]], 'th-b1')
      + at([[0, 4], [0, 3], [1, 4], [2, 4], [4, 4], [3, 3], [4, 3]], 'th-b2')
      + at([[1, 3], [2, 3]], 'th-b3'),
    );
  }

  // 스네이크: 칸 판 위에서 마디로 이어진 뱀(꼬리는 가늘게) → 눈·갈라진 혀가 있는 머리가 사과를 향한다.
  function snake() {
    const X = (c) => 24 + c * 16;
    const Y = (r) => 14 + r * 16;
    let grid = '';
    for (let c = 1; c < 7; c++) grid += `<line x1="${X(c)}" y1="14" x2="${X(c)}" y2="110" class="th-snake-grid"/>`;
    for (let r = 1; r < 6; r++) grid += `<line x1="24" y1="${Y(r)}" x2="136" y2="${Y(r)}" class="th-snake-grid"/>`;
    // 꼬리 → 머리 바로 앞 (ㄱ자로 꺾여 올라가는 몸통)
    const body = [[0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1]];
    // 몸통은 칸 중심을 잇는 굵은 선으로 매끄럽게, 위에 마디 무늬
    const path = body.concat([[3, 1]]).map(([c, r], i) => `${i ? 'L' : 'M'}${X(c) + 8} ${Y(r) + 8}`).join(' ');
    const spots = body.slice(1).map(([c, r]) => `<circle cx="${X(c) + 8}" cy="${Y(r) + 8}" r="2.2" class="th-snake-spot"/>`).join('');
    const hx = X(3) + 9; // 머리 중심
    const hy = Y(1) + 8;
    return svg('snake',
      `<rect x="24" y="14" width="112" height="96" rx="8" class="th-snake-board"/>${grid}`
      + `<path d="${path}" fill="none" class="th-snake-body" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>`
      + `<circle cx="${X(0) + 6}" cy="${Y(4) + 8}" r="5" class="th-snake-tail"/>${spots}`
      // 혀(갈라진 끝)
      + `<path d="M${hx + 9} ${hy} h8 l4 -4 M${hx + 17} ${hy} l4 4" fill="none" class="th-snake-tongue" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
      // 머리: 몸보다 큰 둥근 머리 + 앞을 보는 두 눈
      + `<ellipse cx="${hx}" cy="${hy}" rx="12" ry="10" class="th-snake-head"/>`
      + `<circle cx="${hx + 3}" cy="${hy - 5}" r="3.6" class="th-snake-eye"/><circle cx="${hx + 3}" cy="${hy + 5}" r="3.6" class="th-snake-eye"/>`
      + `<circle cx="${hx + 4.4}" cy="${hy - 5}" r="1.8" class="th-snake-pupil"/><circle cx="${hx + 4.4}" cy="${hy + 5}" r="1.8" class="th-snake-pupil"/>`
      // 사과
      + `<circle cx="${X(6) + 6}" cy="${Y(1) + 9}" r="9" class="th-snake-food"/>`
      + `<path d="M${X(6) + 6} ${Y(1)} q1 -5 4 -6" fill="none" class="th-snake-stem" stroke-width="2" stroke-linecap="round"/>`
      + `<path d="M${X(6) + 8} ${Y(1) - 2} q6 -5 9 0 q-5 3 -9 0z" class="th-snake-leaf"/>`
      + `<circle cx="${X(6) + 3}" cy="${Y(1) + 6}" r="2.2" class="th-snake-shine"/>`,
    );
  }

  // 오목: 나무 판 위 흑돌 다섯 개가 대각선으로 이어지고, 백돌이 사이사이
  function omok() {
    const X = (c) => 34 + c * 15.5;
    const Y = (r) => 16 + r * 14.7;
    let lines = '';
    for (let k = 0; k < 7; k++) {
      lines += `<line x1="${X(k)}" y1="${Y(0)}" x2="${X(k)}" y2="${Y(6)}" class="th-omok-line"/>`;
      lines += `<line x1="${X(0)}" y1="${Y(k)}" x2="${X(6)}" y2="${Y(k)}" class="th-omok-line"/>`;
    }
    const stone = (c, r, cls) => `<circle cx="${X(c)}" cy="${Y(r)}" r="6.6" class="${cls}"/>`;
    const black = [[1, 5], [2, 4], [3, 3], [4, 2], [5, 1]].map(([c, r]) => stone(c, r, 'th-omok-b')).join('');
    const white = [[2, 2], [3, 4], [4, 3], [1, 3], [5, 4]].map(([c, r]) => stone(c, r, 'th-omok-w')).join('');
    return svg('omok', `<rect x="24" y="7" width="113" height="106" rx="7" class="th-omok-wood"/>${lines}`
      + `<line x1="${X(1)}" y1="${Y(5)}" x2="${X(5)}" y2="${Y(1)}" class="th-omok-win"/>${white}${black}`);
  }

  // 벽돌깨기: 색 벽돌 줄 + 비스듬히 튀는 공(점선 자취) + 받침대
  function bricks() {
    const colors = ['th-br1', 'th-br2', 'th-br3'];
    let body = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && (c === 1 || c === 2)) continue; // 깨진 자리
        body += `<rect x="${30 + c * 20.5}" y="${16 + r * 12}" width="18" height="9" rx="2" class="${colors[r]}"/>`;
      }
    }
    return svg('bricks', `<rect x="24" y="8" width="112" height="104" rx="8" class="th-br-board"/>${body}`
      + '<path d="M62 92 L80 58 L96 76" fill="none" class="th-br-trail" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>'
      + '<circle cx="80" cy="56" r="6" class="th-br-ball"/>'
      + '<rect x="46" y="96" width="38" height="8" rx="4" class="th-br-paddle"/>');
  }

  // 점프 러너: 땅 위 울타리를 뛰어넘는 병아리(점프 곡선)
  function runner() {
    return svg('runner', '<rect x="14" y="8" width="132" height="104" rx="8" class="th-run-sky"/>'
      + '<rect x="14" y="88" width="132" height="24" rx="0" class="th-run-ground"/><rect x="14" y="86" width="132" height="5" class="th-run-grass"/>'
      + '<path d="M14 104 h132" class="th-run-dash" stroke-width="3" stroke-dasharray="10 12"/>'
      + '<g class="th-run-fence"><rect x="88" y="62" width="4" height="25"/><rect x="104" y="62" width="4" height="25"/><rect x="85" y="67" width="26" height="4"/><rect x="85" y="77" width="26" height="4"/></g>'
      + '<path d="M30 84 Q66 10 118 70" fill="none" class="th-run-arc" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"/>'
      + '<g transform="translate(70 34)"><ellipse cx="0" cy="0" rx="13" ry="12" class="th-run-chick"/>'
      + '<ellipse cx="-5" cy="-2" rx="7" ry="4" transform="rotate(-25)" class="th-run-wing"/>'
      + '<circle cx="5" cy="-4" r="2" class="th-run-eye"/><path d="M11 -2 L18 1 L11 4z" class="th-run-beak"/></g>'
      + '<circle cx="126" cy="24" r="8" class="th-run-sun"/>');
  }

  function reversi() {
    let body = '<rect x="29" y="9" width="102" height="102" rx="9" class="th-rev-frame"/>';
    const black = new Set([6, 9, 10]), white = new Set([5, 8]);
    for (let i = 0; i < 16; i++) {
      const x = 33 + i % 4 * 24, y = 13 + Math.floor(i / 4) * 24;
      body += `<rect x="${x}" y="${y}" width="24" height="24" class="th-rev-cell"/>`;
      if (black.has(i) || white.has(i)) body += `<circle cx="${x+12}" cy="${y+12}" r="9" class="${black.has(i) ? 'th-rev-black' : 'th-rev-white'}"/>`;
      else if (i === 0 || i === 4 || i === 12) body += `<circle cx="${x+12}" cy="${y+12}" r="3" class="th-rev-legal"/>`;
    }
    return svg('reversi', body);
  }

  function sichuan() {
    const tile = (x, y, type) => {
      let picture;
      if (type === 'apple') picture = `<path d="M${x+14} ${y+12} c-14 -7 -15 17 -4 21 q4 1 6 -1 c12 4 15 -25 0 -20z" fill="#d95c47"/><path d="M${x+14} ${y+12} q-2 -9 6 -9 q2 7 -6 9" fill="#398655"/>`;
      else if (type === 'flower') picture = `<g fill="#d39b27"><circle cx="${x+14}" cy="${y+13}" r="6"/><circle cx="${x+20}" cy="${y+19}" r="6"/><circle cx="${x+14}" cy="${y+25}" r="6"/><circle cx="${x+8}" cy="${y+19}" r="6"/></g><circle cx="${x+14}" cy="${y+19}" r="5" fill="#695032"/>`;
      else picture = `<path d="M${x+14} ${y+7} l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1z" fill="#558cb6"/>`;
      return `<rect x="${x}" y="${y}" width="29" height="40" rx="5" class="th-sc-tile"/>${picture}`;
    };
    return svg('sichuan', '<rect x="18" y="7" width="124" height="107" rx="12" class="th-sc-board"/>'
      + tile(30, 18, 'apple') + tile(65, 18, 'flower') + tile(100, 18, 'apple')
      + tile(30, 66, 'star') + tile(65, 66, 'flower') + tile(100, 66, 'star')
      + '<path d="M44 19 V12 H114 V19" class="th-sc-path" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>');
  }

  function numberBaseball() {
    let body = '<rect x="17" y="11" width="126" height="99" rx="13" class="th-nb-board"/>';
    [4, 2, 7].forEach((digit, i) => {
      const x = 30 + i * 35;
      body += `<rect x="${x}" y="24" width="29" height="40" rx="6" class="th-nb-tile"/><text x="${x+14.5}" y="52" class="th-nb-digit">${digit}</text>`;
    });
    return svg('number-baseball', body + '<rect x="32" y="76" width="43" height="23" rx="7" class="th-nb-strike"/><rect x="85" y="76" width="43" height="23" rx="7" class="th-nb-ball"/>'
      + '<text x="53.5" y="92.5" class="th-nb-score">1S</text><text x="106.5" y="92.5" class="th-nb-score">2B</text>');
  }

  function freecell() {
    let body = '<rect x="15" y="8" width="130" height="104" rx="12" class="th-fc-board"/>';
    for (let i = 0; i < 4; i++) body += `<rect x="${25+i*14}" y="18" width="11" height="17" rx="2" class="th-fc-cell"/>`;
    for (let i = 0; i < 4; i++) body += `<rect x="${88+i*11}" y="18" width="9" height="17" rx="2" class="th-fc-cell"/>`;
    const cards = [['K', '♠', false], ['Q', '♥', true], ['J', '♣', false], ['A', '♦', true]];
    cards.forEach(([value, suit, red], i) => {
      const x = 27+i*27, y = 44+(i%2)*9;
      body += `<rect x="${x}" y="${y}" width="24" height="43" rx="4" class="th-fc-card"/><text x="${x+12}" y="${y+17}" class="th-fc-text${red ? ' th-fc-red' : ''}">${value}</text><text x="${x+12}" y="${y+34}" class="th-fc-text${red ? ' th-fc-red' : ''}">${suit}</text>`;
    });
    return svg('freecell', body);
  }

  function klondike() {
    let body='<rect x="13" y="8" width="134" height="105" rx="12" fill="#526d87"/><rect x="24" y="18" width="25" height="33" rx="4" fill="#294f78" stroke="#b8cee1"/>';
    for(let i=0;i<5;i++){const x=24+i*23,y=62-i*3;body+=`<rect x="${x}" y="${y}" width="20" height="30" rx="3" fill="#fffef8" stroke="#d1d6cd"/><text x="${x+10}" y="${y+20}" text-anchor="middle" font-size="15" font-weight="700" fill="${i%2?'#b52733':'#20342a'}">${['K','Q','J','10','9'][i]}</text>`;}
    return svg('klondike', body+'<rect x="96" y="18" width="25" height="33" rx="4" fill="#fffef8"/><text x="108" y="41" text-anchor="middle" font-size="20" fill="#b52733">A</text>');
  }
  function initialQuiz() {
    return svg('initial-quiz', '<rect x="15" y="9" width="130" height="102" rx="14" class="th-iq-base"/>'+['ㄱ','ㅂ'].map((c,i)=>`<rect x="${34+i*48}" y="22" width="42" height="44" rx="9" class="th-iq-tile"/><text x="${55+i*48}" y="54" class="th-iq-text">${c}</text>`).join('')+['김','밥','꽃','산'].map((c,i)=>`<rect x="${24+i*29}" y="77" width="25" height="24" rx="5" class="th-iq-tile"/><text x="${36.5+i*29}" y="95" class="th-iq-small">${c}</text>`).join(''));
  }
  function proverbQuiz() {
    return svg('proverb-quiz', '<rect x="13" y="10" width="134" height="101" rx="16" class="th-pq-card"/><path d="M32 30h96a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H73L55 92V78H32a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z" class="th-pq-bubble"/><text x="80" y="57" class="th-pq-text">속담</text><rect x="54" y="63" width="52" height="10" rx="4" class="th-pq-blank"/><circle cx="118" cy="91" r="14" class="th-pq-mark"/><text x="118" y="98" class="th-pq-question">?</text>');
  }
  function hanja() {
    return svg('hanja', '<rect x="26" y="8" width="108" height="104" rx="16" class="th-hanja-card"/><text x="80" y="82" class="th-hanja-char">漢</text><rect x="38" y="91" width="30" height="13" rx="6" class="th-hanja-chip"/><rect x="72" y="91" width="48" height="13" rx="6" class="th-hanja-chip"/><text x="53" y="100" class="th-hanja-label">읽기</text><text x="96" y="100" class="th-hanja-label">오늘의 한자</text>');
  }
  function janggi() {
    let body='<rect x="35" y="6" width="90" height="108" rx="8" class="th-jg-board"/>';
    for(let i=0;i<9;i++)body+=`<line x1="${44+i*9}" y1="15" x2="${44+i*9}" y2="105" class="th-jg-line"/>`;
    for(let i=0;i<10;i++)body+=`<line x1="44" y1="${15+i*10}" x2="116" y2="${15+i*10}" class="th-jg-line"/>`;
    body+='<path d="M71 15 89 35 M89 15 71 35 M71 85 89 105 M89 85 71 105" class="th-jg-line"/>';
    for(const [x,y,c,red] of [[80,25,'漢',true],[80,95,'楚',false],[62,55,'車',false],[98,35,'包',true],[80,75,'卒',false]])body+=`<circle cx="${x}" cy="${y}" r="10" class="th-jg-piece"/><text x="${x}" y="${y+5}" class="th-jg-text${red?' th-jg-red':''}">${c}</text>`;
    return svg('janggi', body);
  }
  function go() {
    let b='<rect x="28" y="8" width="104" height="104" rx="8" class="th-go-board"/>';
    for(let i=0;i<9;i++)b+=`<path d="M${36+i*11} 16V104 M36 ${16+i*11}H124" class="th-go-line"/>`;
    for(const [x,y,white] of [[69,49,false],[80,49,true],[80,60,false],[91,49,false],[69,60,true],[91,60,true],[80,71,true]])b+=`<circle cx="${x}" cy="${y}" r="5.2" class="${white?'th-go-white':'th-go-black'}"/>`;
    return svg('go', b);
  }
  function gostop() {
    // 게임 목록과 시작 화면에서도 실제 한국식 화투 그림을 보여 준다.
    return svg('gostop', '<rect x="12" y="10" width="136" height="100" rx="16" fill="#275a43"/>'+[
      [17,24,'Hwatu_January_gwang.svg'],[59,16,'Hwatu_August_gwang.svg'],[101,26,'Hwatu_March_gwang.svg']
    ].map(([x,y,file])=>`<image x="${x}" y="${y}" width="42" height="69" href="${hwatuRoot}${file}"/>`).join(''));
  }

  const DRAW = { sudoku, 2048: game2048, memory, minesweeper, blocks, snake, omok, bricks, runner, reversi, sichuan, 'number-baseball': numberBaseball, freecell, klondike, 'initial-quiz': initialQuiz, 'proverb-quiz': proverbQuiz, hanja, janggi, go, gostop };

  function render(game) {
    if (DRAW[game.id]) return DRAW[game.id]();
    return svg('', `<text x="80" y="76" class="th-fallback">${game.name.slice(0, 1)}</text>`);
  }

  const ratio = id => { const box = (FRAMES[id] || '0 0 160 120').split(' ').map(Number); return `${box[2]} / ${box[3]}`; };
  return { render, ratio };
})();
