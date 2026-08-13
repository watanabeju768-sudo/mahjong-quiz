/* 牌の絵柄を SVG で描く。
   萬子 = 漢数字 ＋「萬」／ 筒子 = 円（一筒は大きな二重丸）／ 索子 = 竹（一索は鳥）。
   牌の下地（象牙色・角丸・厚み）は CSS 側が担当し、ここでは図案だけを描く。
   座標系は viewBox "0 0 60 84"、絵柄を置くのは x:6-54 / y:6-78 の範囲。 */

'use strict';

const TILE_VIEWBOX = '0 0 60 84';

const INK = '#20242b';       // 墨（漢数字・風牌）
const RED = '#b32d1f';       // 朱
const GREEN = '#15743f';     // 緑
const BLUE = '#1f4f8f';      // 藍
const GOLD = '#c8901a';      // 一索のくちばし

const KANJI_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONOR_KANJI = ['東', '南', '西', '北', '', '發', '中'];

/* --- 筒子 ----------------------------------------------------------------- */

// [cx, cy] の並びと半径。実物によくある配置に寄せている。
const PIN_LAYOUTS = {
  2: { r: 10, dots: [[30, 26], [30, 58]] },
  3: { r: 9, dots: [[45, 22], [30, 42], [15, 62]] },
  4: { r: 10, dots: [[19, 26], [41, 26], [19, 58], [41, 58]] },
  5: { r: 9, dots: [[18, 24], [42, 24], [30, 42], [18, 60], [42, 60]] },
  6: { r: 8.5, dots: [[19, 22], [41, 22], [19, 42], [41, 42], [19, 62], [41, 62]] },
  7: { r: 7.5, dots: [[16, 18], [30, 26], [44, 34], [19, 52], [41, 52], [19, 69], [41, 69]] },
  8: { r: 7.5, dots: [[19, 17], [41, 17], [19, 34], [41, 34], [19, 51], [41, 51], [19, 68], [41, 68]] },
  9: { r: 8, dots: [[15, 20], [30, 20], [45, 20], [15, 42], [30, 42], [45, 42], [15, 64], [30, 64], [45, 64]] },
};

// 各筒の色並び（実物と同じく数によって青・緑・朱が混ざる）
const PIN_COLORS = {
  2: [GREEN, BLUE],
  3: [BLUE, GREEN, RED],
  4: [BLUE, BLUE, GREEN, GREEN],
  5: [BLUE, BLUE, RED, GREEN, GREEN],
  6: [GREEN, GREEN, BLUE, BLUE, BLUE, BLUE],
  7: [GREEN, GREEN, GREEN, BLUE, BLUE, BLUE, BLUE],
  8: [BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE],
  9: [GREEN, GREEN, GREEN, BLUE, BLUE, BLUE, RED, RED, RED],
};

function pinDot(cx, cy, r, color) {
  // 外輪・白地・中心の点、の三層で立体感を出す
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbfaf4" stroke="${color}" stroke-width="${r * 0.3}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.24}" fill="${color}"/>`;
}

function pinFace(number) {
  if (number === 1) {
    // 一筒だけは大きな二重丸
    return `
      <circle cx="30" cy="42" r="19" fill="#fbfaf4" stroke="${BLUE}" stroke-width="3"/>
      <circle cx="30" cy="42" r="14" fill="#fbfaf4" stroke="${RED}" stroke-width="5"/>
      <circle cx="30" cy="42" r="7" fill="#fbfaf4" stroke="${BLUE}" stroke-width="3"/>
      <circle cx="30" cy="42" r="2.6" fill="${RED}"/>`;
  }
  const layout = PIN_LAYOUTS[number];
  const colors = PIN_COLORS[number];
  return layout.dots
    .map((dot, index) => pinDot(dot[0], dot[1], layout.r, colors[index]))
    .join('');
}

/* --- 索子 ----------------------------------------------------------------- */

// [cx, cy] は竹の中心。height は竹の長さ。
const SOU_LAYOUTS = {
  2: { h: 30, sticks: [[30, 24], [30, 60]] },
  3: { h: 28, sticks: [[30, 20], [20, 60], [40, 60]] },
  4: { h: 30, sticks: [[19, 24], [41, 24], [19, 60], [41, 60]] },
  5: { h: 25, sticks: [[17, 22], [43, 22], [30, 42], [17, 62], [43, 62]] },
  6: { h: 30, sticks: [[15, 24], [30, 24], [45, 24], [15, 60], [30, 60], [45, 60]] },
  7: { h: 21, sticks: [[30, 16], [15, 44], [30, 44], [45, 44], [15, 68], [30, 68], [45, 68]] },
  8: { h: 28, sticks: [[14, 25], [24.7, 25], [35.3, 25], [46, 25], [14, 59], [24.7, 59], [35.3, 59], [46, 59]] },
  9: { h: 19, sticks: [[15, 19], [30, 19], [45, 19], [15, 42], [30, 42], [45, 42], [15, 65], [30, 65], [45, 65]] },
};

// 実物同様、五索の中央・七索の頭・九索の中段を朱にする
const SOU_RED_INDEXES = { 5: [2], 7: [0], 9: [3, 4, 5] };

function souStick(cx, cy, height, color) {
  // 竹の一節。上下がふくらみ中央がくびれた実物の形に寄せる。
  const half = height / 2;
  const wide = 3.5;   // 節（上下）の太さ
  const waist = 2.5;  // くびれの太さ
  const top = cy - half;
  const bottom = cy + half;
  const knot1 = cy - half * 0.34;
  const knot2 = cy + half * 0.34;

  const body = `
    M ${cx - wide} ${top + 1.6}
    Q ${cx - wide} ${top} ${cx} ${top}
    Q ${cx + wide} ${top} ${cx + wide} ${top + 1.6}
    C ${cx + wide} ${cy - half * 0.5} ${cx + waist} ${cy - half * 0.2} ${cx + waist} ${cy}
    C ${cx + waist} ${cy + half * 0.2} ${cx + wide} ${cy + half * 0.5} ${cx + wide} ${bottom - 1.6}
    Q ${cx + wide} ${bottom} ${cx} ${bottom}
    Q ${cx - wide} ${bottom} ${cx - wide} ${bottom - 1.6}
    C ${cx - wide} ${cy + half * 0.5} ${cx - waist} ${cy + half * 0.2} ${cx - waist} ${cy}
    C ${cx - waist} ${cy - half * 0.2} ${cx - wide} ${cy - half * 0.5} ${cx - wide} ${top + 1.6}
    Z`;

  return `
    <path d="${body}" fill="${color}" stroke="rgba(0,0,0,.22)" stroke-width=".5"/>
    <line x1="${cx - 2.6}" y1="${knot1}" x2="${cx + 2.6}" y2="${knot1}"
          stroke="rgba(255,255,255,.8)" stroke-width="1"/>
    <line x1="${cx - 2.6}" y1="${knot2}" x2="${cx + 2.6}" y2="${knot2}"
          stroke="rgba(255,255,255,.8)" stroke-width="1"/>`;
}

function souBird() {
  // 一索の孔雀。尾羽を下に広げ、頭に朱の冠羽を付ける。
  return `
    <path d="M30 54 q-5 10 -11 17" fill="none" stroke="${GREEN}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M30 54 q0 11 -1 19" fill="none" stroke="${GREEN}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M30 54 q5 10 11 17" fill="none" stroke="${GREEN}" stroke-width="2.8" stroke-linecap="round"/>
    <ellipse cx="30" cy="43" rx="10.5" ry="13.5" fill="${GREEN}"/>
    <path d="M25 33 q10 5 9 19 q-7 -3 -9 -19z" fill="rgba(255,255,255,.32)"/>
    <circle cx="30" cy="24" r="7.2" fill="${GREEN}"/>
    <path d="M27.5 17.5 q1.5 -6.5 4.5 -7.5 q-0.5 4.5 1.5 6.5z" fill="${RED}"/>
    <polygon points="36.4,23.5 45.5,26 36.4,28" fill="${GOLD}"/>
    <circle cx="32.4" cy="22.4" r="1.8" fill="#fbfaf4"/>
    <circle cx="32.8" cy="22.6" r=".85" fill="${INK}"/>
    <path d="M27 70 l-3 4 M33 70 l3 4" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>`;
}

function souFace(number) {
  if (number === 1) return souBird();
  const layout = SOU_LAYOUTS[number];
  const reds = SOU_RED_INDEXES[number] || [];
  return layout.sticks
    .map((stick, index) =>
      souStick(stick[0], stick[1], layout.h, reds.includes(index) ? RED : GREEN))
    .join('');
}

/* --- 萬子・字牌 ----------------------------------------------------------- */

const MINCHO = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";

function manFace(number) {
  return `
    <text x="30" y="35" text-anchor="middle" font-size="30" fill="${INK}"
          font-family="${MINCHO}" font-weight="600">${KANJI_NUMBERS[number - 1]}</text>
    <text x="30" y="71" text-anchor="middle" font-size="28" fill="${RED}"
          font-family="${MINCHO}" font-weight="600">萬</text>`;
}

function honorFace(index) {
  if (index === 4) {
    // 白は文字を持たず、藍色の二重枠だけの牌
    return `
      <rect x="12" y="14" width="36" height="56" rx="3" fill="none"
            stroke="${BLUE}" stroke-width="2.4"/>
      <rect x="15.5" y="17.5" width="29" height="49" rx="2" fill="none"
            stroke="${BLUE}" stroke-width="1" opacity=".5"/>`;
  }
  const color = index === 5 ? GREEN : index === 6 ? RED : INK;
  return `
    <text x="30" y="57" text-anchor="middle" font-size="42" fill="${color}"
          font-family="${MINCHO}" font-weight="600">${HONOR_KANJI[index]}</text>`;
}

/* --- 外部インターフェース ------------------------------------------------- */

/** 34 形式の牌インデックスから、絵柄の SVG 文字列を返す。 */
function tileFaceSvg(tile34) {
  let face;
  if (tile34 >= 27) {
    face = honorFace(tile34 - 27);
  } else {
    const number = (tile34 % 9) + 1;
    const suit = Math.floor(tile34 / 9);
    face = suit === 0 ? manFace(number) : suit === 1 ? pinFace(number) : souFace(number);
  }
  return `<svg viewBox="${TILE_VIEWBOX}" xmlns="http://www.w3.org/2000/svg"
               role="img" aria-hidden="true">${face}</svg>`;
}

/* 牌の読み。数牌は「イー・リャン・サン…」、字牌は「トン・ナン…」。 */
const NUMBER_READINGS = ['イー', 'リャン', 'サン', 'スー', 'ウー', 'ロー', 'チー', 'パー', 'キュー'];
const SUIT_READINGS = ['マン', 'ピン', 'ソー'];
const HONOR_READINGS = ['トン', 'ナン', 'シャー', 'ペー', 'ハク', 'ハツ', 'チュン'];

/** 牌名（"3萬" / "東" など）。 */
function tileName(tile34) {
  if (tile34 >= 27) return ['東', '南', '西', '北', '白', '發', '中'][tile34 - 27];
  const number = (tile34 % 9) + 1;
  return `${number}${['萬', '筒', '索'][Math.floor(tile34 / 9)]}`;
}

/** 牌の読み（"サンマン" / "トン" など）。牌にマウスを乗せると出る。 */
function tileReading(tile34) {
  if (tile34 >= 27) return HONOR_READINGS[tile34 - 27];
  return NUMBER_READINGS[tile34 % 9] + SUIT_READINGS[Math.floor(tile34 / 9)];
}
