/* Wikimedia Commons 한국식 Hwatu 48장. 파일별 저작자·라이선스: ../cards/LICENSE.html.
 * 패 번호는 logic.js/기존 저장과 동일하다. 술잔·다리는 기존 열끗 규칙을 유지한다. */
const GostopArt = (() => {
  const files = [
    "Hwatu_January_gwang.svg", "Hwatu_January_tti.svg", "Hwatu_January_pi_1.svg", "Hwatu_January_pi_2.svg",
    "Hwatu_February_yul.svg", "Hwatu_February_tti.svg", "Hwatu_February_pi_1.svg", "Hwatu_February_pi_2.svg",
    "Hwatu_March_gwang.svg", "Hwatu_March_tti.svg", "Hwatu_March_pi_1.svg", "Hwatu_March_pi_2.svg",
    "Hwatu_April_yul.svg", "Hwatu_April_tti.svg", "Hwatu_April_pi_1.svg", "Hwatu_April_pi_2.svg",
    "Hwatu_May_yul_ssang_pi.svg", "Hwatu_May_tti.svg", "Hwatu_May_pi_1.svg", "Hwatu_May_pi_2.svg",
    "Hwatu_June_yul.svg", "Hwatu_June_tti.svg", "Hwatu_June_pi_1.svg", "Hwatu_June_pi_2.svg",
    "Hwatu_July_yul.svg", "Hwatu_July_tti.svg", "Hwatu_July_pi_1.svg", "Hwatu_July_pi_2.svg",
    "Hwatu_August_gwang.svg", "Hwatu_August_yul.svg", "Hwatu_August_pi_1.svg", "Hwatu_August_pi_2.svg",
    "Hwatu_September_yul_ssang_pi.svg", "Hwatu_September_tti.svg", "Hwatu_September_pi_1.svg", "Hwatu_September_pi_2.svg",
    "Hwatu_October_yul.svg", "Hwatu_October_tti.svg", "Hwatu_October_pi_1.svg", "Hwatu_October_pi_2.svg",
    "Hwatu_November_gwang.svg", "Hwatu_November_ssang_pi.svg", "Hwatu_November_pi_1.svg", "Hwatu_November_pi_2.svg",
    "Hwatu_December_gwang.svg", "Hwatu_December_yul.svg", "Hwatu_December_tti.svg", "Hwatu_December_ssang_pi.svg",
  ];
  function src(id) {
    if (!Number.isInteger(id) || id < 0 || id >= files.length) throw new RangeError('없는 화투패');
    return 'cards/' + files[id];
  }
  function face(id, showHelp = true) {
    return `<img class="card-face" src="${src(id)}" width="512" height="839" alt="" draggable="false">${showHelp ? `<span class="month-badge" aria-hidden="true">${Math.floor(id / 4) + 1}</span>` : ''}`;
  }
  return {src, face};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GostopArt;
