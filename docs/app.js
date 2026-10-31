/* 麻雀 点数計算クイズ — フロントエンド
   採点はすべてサーバー（mahjong ライブラリ）が行う。ここは表示と入力だけ。 */

'use strict';

const HAN_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const FU_CHOICES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

const el = (id) => document.getElementById(id);

/* マウスとキーボードで使う端末（PC）か。スマホでは自動で入力欄に移らない
   （キーボードが開いて手牌が隠れるため）。 */
const IS_DESKTOP = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* 成績の保存先。使えない環境（プライベートブラウズなど）では null（保存しないだけ）。 */
const STORAGE = (() => {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
})();

/* 麻雀用語のふりがな。画面に出た文字（説明文・ヒント・結果など）に後から付ける
   （rubifyNode）。長い語から先に当てるので「翻数」は「翻」より優先される。
   役名・符の名前のように、もともと読みを添えて出すものには付けない。 */
const RUBY_TERMS = {
  翻数: 'ハンすう', 翻: 'ハン', 符: 'フ', 副底: 'フーテイ', 門前加符: 'メンゼンカフ', 門前: 'メンゼン',
  場風: 'バカゼ', 自風: 'ジカゼ', 連風牌: 'レンフォンパイ', 風牌: 'カゼハイ', 三元牌: 'サンゲンパイ',
  東場: 'トンば', 南場: 'ナンば', 西場: 'シャーば', 北場: 'ペーば',
  東家: 'トンチャ', 南家: 'ナンチャ', 西家: 'シャーチャ', 北家: 'ペーチャ',
  東: 'トン', 南: 'ナン', 西: 'シャー', 北: 'ペー', 白: 'ハク', 發: 'ハツ',
  萬子: 'マンズ', 筒子: 'ピンズ', 索子: 'ソーズ',
  数牌: 'シューパイ', 字牌: 'ジハイ', 中張牌: 'チュンチャンパイ', 么九牌: 'ヤオチューハイ',
  ドラ表示牌: 'ドラひょうじハイ', 嶺上牌: 'リンシャンハイ', 手牌: 'てハイ', 牌: 'ハイ',
  刻子: 'コーツ', 順子: 'シュンツ', 槓子: 'カンツ', 対子: 'トイツ', 面子: 'メンツ', 雀頭: 'ジャントウ',
  暗刻: 'アンコ', 明刻: 'ミンコ', 暗槓: 'アンカン', 明槓: 'ミンカン', 加槓: 'カカン',
  辺張: 'ペンチャン', 嵌張: 'カンチャン', 単騎: 'タンキ', 両面: 'リャンメン',
  放銃者: 'ホウジュウしゃ', 放銃: 'ホウジュウ', 流局: 'リュウキョク', 巡: 'ジュン', 局: 'キョク',
  鳴: 'な', 和了: 'あが', 喰: 'く',
  立直: 'リーチ', 一発: 'イッパツ', 役牌: 'ヤクハイ', 数え役満: 'かぞえヤクマン', 役満: 'ヤクマン',
  三倍満: 'サンバイマン', 満貫: 'マンガン', 跳満: 'ハネマン', 倍満: 'バイマン',
  平和形: 'ピンフがた', 平和: 'ピンフ', 断幺九: 'タンヤオ', 一盃口: 'イーペーコー', 二盃口: 'リャンペーコー',
  七対子: 'チートイツ', 三暗刻: 'サンアンコー', 四暗刻: 'スーアンコー', 対々和: 'トイトイ',
  混一色: 'ホンイツ', 清一色: 'チンイツ', 三色同順: 'サンショクドウジュン', 一気通貫: 'イッキツウカン',
};
// 一字では別の意味にもなる字は、前後を見て麻雀の牌のときだけ付ける
//   中: 「白・發・中」「中を3枚」　萬・筒・索: 「123萬」のように数字の直後
const RUBY_CONTEXT = [
  ['(?<=[・→])中|中(?=[を・→])', 'チュン'],
  ['(?<=\\d)萬', 'マン'],
  ['(?<=\\d)筒', 'ピン'],
  ['(?<=\\d)索', 'ソー'],
];
const RUBY_READING = Object.assign({}, RUBY_TERMS, { 中: 'チュン', 萬: 'マン', 筒: 'ピン', 索: 'ソー' });
const RUBY_PATTERN = new RegExp(
  Object.keys(RUBY_TERMS)
    .sort((a, b) => b.length - a.length)
    .concat(RUBY_CONTEXT.map(([pattern]) => pattern))
    .join('|'),
  'g',
);

/** 要素の中の文字に、麻雀用語のふりがなを付ける。牌の絵柄や既存のふりがなは触らない。 */
function rubifyNode(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('ruby, svg, option, select, script, style, textarea')) {
        return NodeFilter.FILTER_REJECT;
      }
      RUBY_PATTERN.lastIndex = 0;
      return RUBY_PATTERN.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);

  targets.forEach((node) => {
    const fragment = document.createDocumentFragment();
    const text = node.nodeValue;
    let last = 0;
    RUBY_PATTERN.lastIndex = 0;
    let match;
    while ((match = RUBY_PATTERN.exec(text)) !== null) {
      if (match.index > last) fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
      const ruby = document.createElement('ruby');
      ruby.appendChild(document.createTextNode(match[0]));
      const rt = document.createElement('rt');
      rt.textContent = RUBY_READING[match[0]] || '';
      ruby.appendChild(rt);
      fragment.appendChild(ruby);
      last = match.index + match[0].length;
    }
    if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(fragment, node);
  });
}

/* 問題画面・回答欄の「？」で出す用語の説明。役名・符の説明は採点結果に含まれて届く。 */
const GLOSSARY = {
  場風: 'その局の風。「東場」なら東が場風。場風の牌を3枚そろえると役（役牌）になり、雀頭にすると2符付く。',
  自風: '自分の席の風。親はいつも東家で、そこから反時計回りに南家・西家・北家となる。自風の牌を3枚そろえると役（役牌）になり、雀頭にすると2符付く。',
  親: 'この問題のあなたは親（東家）。和了ったときの点数が子の1.5倍になる。',
  子: 'この問題のあなたは子（親以外の3人）。子がツモで和了ると、親は子の倍の額を払う。',
  ツモ: '自分で引いた牌で和了ること。点数はほかの3人が分けて払う。子の和了りなら「子から-親から」、親の和了りなら「◯◯オール」で答える。',
  ロン: 'ほかの人が捨てた牌で和了ること。捨てた人（放銃者）が1人で全額を払う。',
  立直: '鳴かずにテンパイ（あと1枚で和了れる状態）したときに宣言する1翻の役。',
  一発: '立直してから1巡以内に、間に鳴きが入らずに和了る1翻の役。',
  ドラ表示牌: '表示された牌の「次」の牌がドラ。数牌は数字が1つ上（9の次は1）、風牌は東→南→西→北→東、三元牌は白→發→中→白の順。手の中のドラ1枚ごとに1翻増える（役ではないので、ドラだけでは和了れない）。',
  手牌: '左が鳴いていない牌、黄色の枠が和了った牌。ポン・チーなどで鳴いた牌は右側に並ぶ。',
  ポン: 'ほかの人の捨て牌をもらって、同じ牌3枚の組（刻子）を作ること。鳴いた手になる。',
  チー: '左隣の人の捨て牌をもらって、順子（123のように数字が続く3枚）を作ること。鳴いた手になる。',
  カン: '同じ牌4枚の組（槓子）を作ること。刻子より符が大きい。',
  加槓: 'ポンした3枚に、自分で引いた4枚目を加えてカンすること。',
  翻数: '成立した役の翻の合計。ドラも1枚につき1翻として足す。翻が多いほど点数が高く、5翻以上は符に関係なく満貫（子8000点）以上になる。',
  符: '手の形や和了り方で決まる、もう1つの点。基本の符（副底）に、刻子・雀頭・待ち・ツモなどの符を足し、1の位を切り上げる（例: 32符→40符）。七対子はいつも25符。',
  点数: '翻と符の組み合わせから点数表で決まる。ロンは放銃者が全額、ツモはほかの3人が分けて払う。',
};
const state = {
  problem: null,
  han: null,
  fu: null,
  answered: false,
  correct: null,          // 答え合わせ後の正解データ（早見表で答えのマスに印を付ける）
  hintUsed: false,
  hintTab: 'fu',          // ヒントで最後に開いたタブ（fu: 符計算の手順 / table: 点数早見表）
  tableView: null,        // 早見表で見ている { isDealer, isTsumo }（初期値は問題に合わせる）
  isReview: false,        // いまの問題が復習モードからの出題か
  progress: loadProgress(STORAGE),   // 成績と復習リスト（progress.js）
};

/* --- 牌の描画 ------------------------------------------------------------ */

function tileElement(tile34, options = {}) {
  const node = document.createElement('div');
  node.className = 'tile';
  if (options.small) node.classList.add('small');
  if (options.mini) node.classList.add('mini');
  if (options.win) node.classList.add('win');
  if (options.rotated) node.classList.add('rotated');
  // ホバーで牌の名前と読みを表示（例: 3萬（サンマン））
  node.title = `${tileName(tile34)}（${tileReading(tile34)}）`;
  node.innerHTML = tileFaceSvg(tile34);   // 絵柄は tileface.js が描く
  return node;
}

function tileRow(tiles, options = {}) {
  const row = document.createElement('div');
  row.className = 'tiles';
  tiles.forEach((tile) => row.appendChild(tileElement(tile, options)));
  return row;
}

/* --- 問題の描画 ---------------------------------------------------------- */

function renderProblem(problem) {
  const board = el('board');
  board.innerHTML = '';

  const titleText = [state.isReview ? '復習' : '', problem.title].filter(Boolean).join('：');
  if (titleText) {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = titleText;
    board.appendChild(title);
  }

  // バッジは押すと用語の説明が出る（自風のバッジは親・子の説明も添える）
  const badges = document.createElement('div');
  badges.className = 'badges';
  badges.dataset.helpAnchor = '';
  const items = [
    { text: `${problem.roundWind}場`, terms: ['場風'] },
    { text: `${problem.playerWind}家（${problem.seat}）`, terms: ['自風', problem.seat] },
    { text: problem.winType, terms: [problem.winType], strong: true },
    ...problem.conditions.map((text) => ({ text: text, terms: [text], strong: true })),
  ];
  items.forEach((item) => {
    badges.appendChild(termButton(item.text, item.terms, item.strong ? 'badge strong' : 'badge'));
  });
  board.appendChild(badges);

  // ドラ表示牌
  const doraRow = document.createElement('div');
  doraRow.className = 'row';
  doraRow.appendChild(rowLabel('ドラ表示牌'));
  const doraLine = document.createElement('div');
  doraLine.className = 'dora-row';
  doraLine.appendChild(tileRow(problem.doraIndicators, { small: true }));
  const arrow = document.createElement('span');
  arrow.className = 'dora-arrow';
  arrow.textContent = '→ ドラは';
  doraLine.appendChild(arrow);
  doraLine.appendChild(tileRow(problem.dora, { small: true }));
  doraRow.appendChild(doraLine);
  board.appendChild(doraRow);

  // 手牌 ＋ 和了牌
  const handRow = document.createElement('div');
  handRow.className = 'row';
  handRow.appendChild(rowLabel('手牌'));
  const hand = document.createElement('div');
  hand.className = 'hand';
  hand.appendChild(tileRow(problem.concealed));
  const winGroup = document.createElement('div');
  winGroup.className = 'win-group';
  winGroup.appendChild(tileElement(problem.winTile, { win: true }));
  const winLabel = document.createElement('span');
  winLabel.className = 'meld-label';
  winLabel.textContent = problem.winType;
  winGroup.appendChild(winLabel);
  hand.appendChild(winGroup);
  handRow.appendChild(hand);

  problem.melds.forEach((meld) => {
    const group = document.createElement('div');
    group.className = 'meld-group';
    group.dataset.helpAnchor = '';
    group.appendChild(termButton(meld.type, [meld.type], 'meld-label'));
    group.appendChild(tileRow(meld.tiles, { small: true }));
    handRow.appendChild(group);
  });

  board.appendChild(handRow);
  rubifyNode(board);
}

/* --- 用語の説明（「？」） ------------------------------------------------- */

/** 押すと terms の説明を出すボタン。説明は最寄りの [data-help-anchor] の直後に開く。 */
function termButton(text, terms, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `term ${className}`;
  button.textContent = text;
  const mark = document.createElement('span');
  mark.className = 'term-mark';
  mark.textContent = '?';
  mark.setAttribute('aria-hidden', 'true');
  button.appendChild(mark);
  button.dataset.terms = terms.join(',');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => toggleHelp(button));
  return button;
}

/** 「ドラ表示牌 ?」のような行見出し。 */
function rowLabel(term) {
  const label = document.createElement('div');
  label.className = 'row-label';
  label.dataset.helpAnchor = '';
  label.appendChild(termButton(term, [term], 'label-term'));
  return label;
}

function closeHelp() {
  document.querySelectorAll('.term-help').forEach((node) => node.remove());
  document.querySelectorAll('.term[aria-expanded="true"]').forEach((node) => {
    node.setAttribute('aria-expanded', 'false');
  });
}

function toggleHelp(button) {
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  closeHelp();
  if (wasOpen) return;

  const help = document.createElement('div');
  help.className = 'term-help';
  help.setAttribute('role', 'note');
  button.dataset.terms.split(',').forEach((term) => {
    if (!GLOSSARY[term]) return;
    const line = document.createElement('p');
    const name = document.createElement('b');
    name.textContent = term;
    line.appendChild(name);
    line.appendChild(document.createTextNode(GLOSSARY[term]));
    help.appendChild(line);
  });
  const anchor = button.closest('[data-help-anchor]') || button;
  anchor.insertAdjacentElement('afterend', help);
  rubifyNode(help);
  button.setAttribute('aria-expanded', 'true');
}

/* --- ヒント（符計算の手順表・点数早見表） ----------------------------------- */

const SCORE_TABLE_FU = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
const LIMIT_ROWS = [
  { han: 5, label: '満貫', hanText: '5翻' },
  { han: 6, label: '跳満', hanText: '6〜7翻' },
  { han: 8, label: '倍満', hanText: '8〜10翻' },
  { han: 11, label: '三倍満', hanText: '11〜12翻' },
  { han: 13, label: '役満', hanText: '13翻〜' },
];

const FU_STEPS_HTML = `
  <ol class="steps">
    <li><b>特別な形を先に確認</b>七対子は25符で終わり。平和のツモは20符で終わり。</li>
    <li><b>副底 20符</b>どんな和了りにも付く基本の符。</li>
    <li><b>門前でロンなら +10符</b>鳴いていない手でロンしたとき（門前加符）。</li>
    <li><b>ツモなら +2符</b>鳴いていても付く。平和のツモだけは付かない。</li>
    <li><b>面子の符</b>刻子・槓子は下の表。順子（123など）は0符。</li>
    <li><b>雀頭の符</b>白・發・中・場風・自風なら +2符。場風と自風が同じ牌なら +4符。</li>
    <li><b>待ちの符</b>辺張（12で3待ち）・嵌張（46で5待ち）・単騎（雀頭待ち）は +2符。両面・シャンポンは0符。</li>
    <li><b>10符単位に切り上げ</b>例: 32符→40符。鳴いた手で合計20符なら30符にする。</li>
  </ol>
  <table class="hint-table">
    <thead><tr><th></th><th>2〜8の数牌<small>中張牌</small></th><th>1・9・字牌<small>么九牌</small></th></tr></thead>
    <tbody>
      <tr><th>明刻<small>ポン</small></th><td>2符</td><td>4符</td></tr>
      <tr><th>暗刻<small>鳴かずに3枚</small></th><td>4符</td><td>8符</td></tr>
      <tr><th>明槓<small>鳴いてカン</small></th><td>8符</td><td>16符</td></tr>
      <tr><th>暗槓<small>鳴かずにカン</small></th><td>16符</td><td>32符</td></tr>
    </tbody>
  </table>
  <p class="hint-note">ロンで3枚目がそろった刻子は、鳴かずにそろえていても明刻として数える。</p>`;

/** 早見表のマス 1 つ分の文字。ありえない組み合わせは null。 */
function tableCell(han, fu, isDealer, isTsumo) {
  if (fu === 20 && (!isTsumo || han < 2)) return null;    // 20符は平和ツモだけ（2翻から）
  if (fu === 25 && (han < 2 || (isTsumo && han < 3))) return null;  // 25符は七対子だけ
  const score = scoreFor(han, fu, isDealer, isTsumo);
  if (!isTsumo) return String(score.main);
  if (isDealer) return `${score.main}オール`;
  return `${score.additional}-${score.main}`;
}

function scoreTableHtml(view) {
  const who = view.isDealer ? '親' : '子';
  const how = view.isTsumo ? 'ツモ' : 'ロン';
  let html = '<div class="segments">';
  [[false, '子'], [true, '親']].forEach(([value, label]) => {
    html += `<button type="button" class="segment" data-view="isDealer" data-value="${value}"`
      + ` aria-pressed="${view.isDealer === value}">${label}</button>`;
  });
  html += '<span class="segment-gap"></span>';
  [[false, 'ロン'], [true, 'ツモ']].forEach(([value, label]) => {
    html += `<button type="button" class="segment" data-view="isTsumo" data-value="${value}"`
      + ` aria-pressed="${view.isTsumo === value}">${label}</button>`;
  });
  html += '</div>';

  const format = view.isTsumo
    ? (view.isDealer ? '「◯◯オール」＝子3人がそれぞれ払う額' : '「子から-親から」の順')
    : '放銃者が1人で払う額';
  html += `<p class="hint-note">${who}の${how}（${format}）。翻（横）と符（縦）が交わるマスが点数。`
    + '色の付いたマスは満貫。</p>';

  // 答え合わせの後は、この問題の答えのマス（または満貫以上の行）に印を付ける
  const answer = state.answered ? state.correct : null;
  const answerLimit = answer ? answerLimitRow(answer) : null;
  if (answer) {
    const formula = answer.fu ? `${answer.han}翻 ${answer.fu}符` : `${answer.han}翻`;
    html += `<p class="hint-answer">★ この問題の答え: ${formula}（${answer.seat}の${answer.winType}）`
      + ` → ${answer.total.toLocaleString()}点。★のマスが答えです。</p>`;
  }

  html += '<div class="table-scroll"><table class="hint-table score-table"><thead><tr><th></th>';
  [1, 2, 3, 4].forEach((han) => { html += `<th>${han}翻</th>`; });
  html += '</tr></thead><tbody>';
  SCORE_TABLE_FU.forEach((fu) => {
    html += `<tr><th>${fu}符</th>`;
    [1, 2, 3, 4].forEach((han) => {
      const text = tableCell(han, fu, view.isDealer, view.isTsumo);
      const classes = [];
      if (fu * 2 ** (2 + han) >= 2000) classes.push('limit');
      const isAnswer = answer && !answerLimit && answer.han === han && answer.fu === fu;
      if (isAnswer) classes.push('answer');
      const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
      html += text === null
        ? '<td class="none">—</td>'
        : `<td${classAttr}>${isAnswer ? '★ ' : ''}${text}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  html += '<table class="hint-table limit-table"><tbody>';
  LIMIT_ROWS.forEach((row) => {
    const isAnswer = answerLimit === row;
    html += `<tr${isAnswer ? ' class="answer"' : ''}><th>${isAnswer ? '★ ' : ''}${row.label}<small>${row.hanText}</small></th>`
      + `<td>${tableCell(row.han, 30, view.isDealer, view.isTsumo)}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

/** 答えが表の 1〜4翻 の範囲外（5翻以上・役満）なら、満貫以上の表のどの行かを返す。 */
function answerLimitRow(answer) {
  const isYakuman = !answer.fu || answer.han >= 13;
  if (!isYakuman && answer.han <= 4) return null;
  if (isYakuman) return LIMIT_ROWS[LIMIT_ROWS.length - 1];
  return LIMIT_ROWS.slice().reverse().find((row) => answer.han >= row.han) || null;
}

function renderHint() {
  const hint = el('hint');
  const tabs = [['fu', '符計算の手順'], ['table', '点数早見表']];
  let html = '<div class="hint-head"><div class="tabs" role="tablist">';
  tabs.forEach(([key, label]) => {
    html += `<button type="button" class="tab" role="tab" data-tab="${key}"`
      + ` aria-selected="${state.hintTab === key}">${label}</button>`;
  });
  const flag = state.answered
    ? '答え合わせの後なので、記録には影響しません'
    : 'この問題は「ヒントあり」になります';
  html += `</div><span class="hint-flag">${flag}</span></div>`;
  html += `<div class="hint-body" role="tabpanel">${state.hintTab === 'fu' ? FU_STEPS_HTML : scoreTableHtml(state.tableView)}</div>`;
  hint.innerHTML = html;
  rubifyNode(hint);

  hint.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.hintTab = tab.dataset.tab;
      renderHint();
    });
  });
  hint.querySelectorAll('.segment').forEach((button) => {
    button.addEventListener('click', () => {
      state.tableView[button.dataset.view] = button.dataset.value === 'true';
      renderHint();
    });
  });
}

function openHint() {
  // 答え合わせの後に見る分には「ヒントあり」にしない（間違えた理由を確かめるため）
  if (!state.answered) state.hintUsed = true;
  if (!state.tableView) {
    state.tableView = { isDealer: state.problem.isDealer, isTsumo: state.problem.isTsumo };
  }
  renderHint();
  el('hint').hidden = false;
  el('hint-open').setAttribute('aria-expanded', 'true');
  el('hint').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleHint() {
  if (el('hint').hidden) {
    openHint();
  } else {
    el('hint').hidden = true;
    el('hint-open').setAttribute('aria-expanded', 'false');
  }
}

/* --- 回答フォーム -------------------------------------------------------- */

function buildChips(container, values, onSelect) {
  container.innerHTML = '';
  values.forEach((value) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = value;
    chip.dataset.value = value;
    chip.addEventListener('click', () => {
      Array.from(container.children).forEach((node) => node.classList.remove('selected'));
      chip.classList.add('selected');
      onSelect(value);
      updateSubmitState();
      moveToNextField();
    });
    container.appendChild(chip);
  });
}

/* --- キーボード操作 ------------------------------------------------------ */

/* 数字キーは「まだ選んでいない欄」に入る。翻 → 符 → 点数の順。 */
function keyboardTarget() {
  if (!state.problem || state.answered) return null;
  if (state.han === null) return 'han';
  if (state.problem.askFu && state.fu === null) return 'fu';
  return 'points';
}

/** 数字キーが入る欄に印を付け、点数の番になったら（PC では）入力欄に移る。 */
function moveToNextField() {
  const target = keyboardTarget();
  el('han-field').classList.toggle('active', target === 'han');
  el('fu-field').classList.toggle('active', target === 'fu');
  el('points-field').classList.toggle('active', target === 'points');
  if (IS_DESKTOP && target === 'points' && document.activeElement !== el('points')) {
    el('points').focus({ preventScroll: true });
  }
}

/* 「1」は 1翻 にも 10〜13翻 にもなりうるので、続く数字を少し待つ。
   候補が 1 つに絞れたらすぐ決める（符は「3」で 30、「2」「5」で 25）。 */
const DIGIT_WAIT_MS = 700;
const digitInput = { buffer: '', timer: null };

function clearDigitInput() {
  clearTimeout(digitInput.timer);
  digitInput.buffer = '';
  document.querySelectorAll('.chip.candidate').forEach((chip) => chip.classList.remove('candidate'));
}

function chipFor(target, value) {
  return document.querySelector(`#${target}-chips .chip[data-value="${value}"]`);
}

function handleDigit(target, digit) {
  const values = target === 'han' ? HAN_CHOICES : FU_CHOICES;
  const matching = (buffer) => values.filter((value) => String(value).startsWith(buffer));

  let buffer = digitInput.buffer + digit;
  if (matching(buffer).length === 0) buffer = digit;   // 続かない数字なら打ち直しとみなす
  const candidates = matching(buffer);
  clearDigitInput();
  if (candidates.length === 0) return;

  if (candidates.length === 1) {
    chipFor(target, candidates[0]).click();
    return;
  }
  digitInput.buffer = buffer;
  candidates.forEach((value) => chipFor(target, value).classList.add('candidate'));
  digitInput.timer = setTimeout(() => {
    const exact = Number(buffer);
    clearDigitInput();
    if (values.includes(exact)) chipFor(target, exact).click();
  }, DIGIT_WAIT_MS);
}

/** Backspace: 最後に選んだもの（符 → 翻）を外す。 */
function undoLastChoice() {
  const target = state.problem.askFu && state.fu !== null ? 'fu' : (state.han !== null ? 'han' : null);
  if (!target) return;
  state[target] = null;
  document.querySelectorAll(`#${target}-chips .chip`).forEach((chip) => chip.classList.remove('selected'));
  updateSubmitState();
  moveToNextField();
}

function onKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  const key = event.key;
  const node = event.target;
  const inPoints = node === el('points');
  const inOtherControl = !inPoints && node.closest && node.closest('input, select, textarea');
  if (inOtherControl) return;

  // 結果表示中: Enter / N で次の問題へ（ボタンにフォーカスがあるときの Enter はボタン側に任せる）
  if (state.answered) {
    if (key.toLowerCase() === 'h') {
      event.preventDefault();
      toggleHint();
      return;
    }
    const onButton = node.tagName === 'BUTTON';
    if ((key === 'Enter' && !onButton) || key.toLowerCase() === 'n') {
      event.preventDefault();
      loadProblem();
    }
    return;
  }
  if (!state.problem) return;

  if (key === 'Escape') {
    closeHelp();
    if (!el('hint').hidden) toggleHint();
    if (inPoints) el('points').blur();
    return;
  }
  if (key === 'Enter') {
    if (node.tagName === 'BUTTON' && !inPoints) return;
    event.preventDefault();
    if (!el('submit').disabled) submitAnswer();
    return;
  }
  if (inPoints) return;   // 点数欄の中は普通に文字入力

  if (key.toLowerCase() === 'h') {
    event.preventDefault();
    toggleHint();
    return;
  }
  if (key === 'Backspace') {
    event.preventDefault();
    clearDigitInput();
    undoLastChoice();
    return;
  }
  if (/^[0-9]$/.test(key)) {
    const target = keyboardTarget();
    event.preventDefault();
    if (target === 'points') {
      el('points').focus({ preventScroll: true });
      el('points').value += key;
      updateSubmitState();
    } else if (target) {
      handleDigit(target, key);
    }
  }
}

function updateSubmitState() {
  const needsFu = state.problem && state.problem.askFu;
  const ready =
    state.han !== null &&
    (!needsFu || state.fu !== null) &&
    el('points').value.trim() !== '';
  el('submit').disabled = !ready || state.answered;
}

function resetForm() {
  state.han = null;
  state.fu = null;
  state.answered = false;
  state.correct = null;
  state.hintUsed = false;
  state.tableView = null;
  el('hint').hidden = true;
  el('hint-open').setAttribute('aria-expanded', 'false');
  el('hint-open').disabled = false;

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.remove('selected');
    chip.disabled = false;
  });
  const points = el('points');
  points.value = '';
  points.disabled = false;
  el('giveup').disabled = false;

  const problem = state.problem;
  el('fu-field').hidden = !problem.askFu;
  // 入力例に具体的な点数を書くと答えのヒントになってしまうため、書式だけを示す
  el('points-hint').textContent = problem.isTsumo
    ? problem.isDealer
      ? '（「◯◯オール」または合計点）'
      : '（「子から-親から」の順、または合計点）'
    : '（放銃者からの一括払い）';
  rubifyNode(el('points-hint'));
  el('points').placeholder = problem.isTsumo
    ? problem.isDealer ? '◯◯オール' : '子から-親から'
    : '点数を入力';

  closeHelp();
  el('answer').hidden = false;
  el('result').hidden = true;
  el('next-wrap').hidden = true;

  // 点数の書式に合うボタンだけ出す（子のツモ=「-」、親のツモ=「オール」）
  el('insert-dash').hidden = !(problem.isTsumo && !problem.isDealer);
  el('insert-all').hidden = !(problem.isTsumo && problem.isDealer);
  el('insert-dash').disabled = false;
  el('insert-all').disabled = false;

  clearDigitInput();
  updateSubmitState();
  moveToNextField();
}

function lockForm() {
  state.answered = true;
  document.querySelectorAll('.chip').forEach((chip) => { chip.disabled = true; });
  el('points').disabled = true;
  el('submit').disabled = true;
  el('giveup').disabled = true;
  el('hint').hidden = true;
  el('hint-open').setAttribute('aria-expanded', 'false');
  el('insert-dash').disabled = true;
  el('insert-all').disabled = true;
  clearDigitInput();
  moveToNextField();
}

/* --- 結果の描画 ---------------------------------------------------------- */

/** 「平和」に「ピンフ」のふりがなを振る。読みが無ければそのまま返す。 */
function withRuby(name, reading) {
  if (!reading) return name;
  return `<ruby>${name}<rp>（</rp><rt>${reading}</rt><rp>）</rp></ruby>`;
}

const DORA_DESCRIPTION = 'ドラの牌1枚ごとに1翻増える。役ではないので、ドラだけでは和了れない。';

/** 役・符の 1 行。名前と値の下に、説明と該当する牌を並べる。 */
function explainRow(nameHtml, value, description, options = {}) {
  let html = `<div class="explain-row${options.total ? ' total' : ''}">`;
  html += `<div class="explain-head"><span class="explain-name">${nameHtml}</span>`;
  html += `<span class="num">${value}</span></div>`;
  if (description) {
    html += `<div class="explain-desc">${description}</div>`;
  }
  if (options.tiles && options.tiles.length > 0) {
    html += `<div class="explain-tiles">${tileRow(options.tiles, { mini: true }).outerHTML}</div>`;
  }
  html += '</div>';
  return html;
}

function judgeRow(name, ok, yours, truth) {
  return `
    <div class="judge ${ok ? 'ok' : 'ng'}">
      <span class="mark">${ok ? '○' : '×'}</span>
      <span class="name">${name}</span>
      <span class="yours">あなたの回答: ${yours || '—'}</span>
      <span class="truth">${truth}</span>
    </div>`;
}

function renderResult(data) {
  const correct = data.correct;
  state.correct = correct;
  const perfect = data.hanOk && data.fuOk && data.pointsOk;
  const hintUsed = state.hintUsed;
  const result = el('result');

  let html = '';
  html += `<div class="verdict ${perfect ? 'ok' : 'ng'}">`;
  if (perfect) {
    html += hintUsed ? '正解！ 次はヒントなしで挑戦 🀄' : '正解！ すばらしい 🀄';
  } else {
    html += '惜しい！ 内訳を確認しましょう';
  }
  html += '</div>';
  const outcome = recordResult(state.progress, {
    id: state.problem.id,
    hanOk: data.hanOk,
    fuOk: data.fuOk,
    pointsOk: data.pointsOk,
    askFu: data.askFu,
    hintUsed: hintUsed,
    correct: correct,
  });
  saveProgress(state.progress, STORAGE);
  renderStats();

  const notes = [];
  if (hintUsed) notes.push('ヒントあり（全問正解・連続・正解率には数えません）');
  if (outcome.inReview) {
    notes.push(`復習リストに入れました（復習待ち ${state.progress.review.length}問）`);
  } else if (outcome.wasInReview) {
    notes.push(`復習リストから外しました（復習待ち ${state.progress.review.length}問）`);
  }
  if (notes.length > 0) {
    html += `<div class="hint-used">${notes.join('<br>')}</div>`;
  }

  html += '<div class="judge-list">';
  html += judgeRow('翻数', data.hanOk, state.han === null ? '' : `${state.han}翻`, `${correct.han}翻`);
  if (data.askFu) {
    html += judgeRow('符', data.fuOk, state.fu === null ? '' : `${state.fu}符`, `${correct.fu}符`);
  }
  const yourPoints = data.pointsParsed ? data.yourPoints : (data.yourPoints ? `${data.yourPoints}（書式不明）` : '');
  html += judgeRow('点数', data.pointsOk, yourPoints, `${correct.total}点`);
  html += '</div>';

  // 成立している役（各行に、どう作る役かのひとこと説明を添える）
  html += '<div class="section-title">成立している役</div><div class="explain-list">';
  if (correct.yaku.length === 0) {
    html += explainRow('役なし', '', '');
  }
  correct.yaku.forEach((yaku) => {
    html += explainRow(withRuby(yaku.name, yaku.reading), `${yaku.han}翻`, yaku.description);
  });
  if (correct.dora > 0) {
    html += explainRow('ドラ', `${correct.dora}翻`, DORA_DESCRIPTION);
  }
  html += explainRow('合計', `${correct.han}翻`, '', { total: true });
  html += '</div>';

  // 符の内訳（各行に、言葉の説明と「この手のどの牌か」を添える）
  if (correct.fuDetails.length > 0) {
    html += '<div class="section-title">符計算の内訳</div><div class="explain-list">';
    correct.fuDetails.forEach((detail) => {
      html += explainRow(withRuby(detail.reason, detail.reading), `${detail.fu}符`,
        detail.description, { tiles: detail.tiles });
    });
    if (correct.fuRaw !== correct.fu) {
      html += explainRow(`小計 ${correct.fuRaw}符 → 切り上げ`, `${correct.fu}符`,
        '符は1の位を切り上げて10符単位にする。', { total: true });
    } else {
      html += explainRow('合計', `${correct.fu}符`, '', { total: true });
    }
    html += '</div>';
  } else {
    html += '<div class="section-title">符計算</div>';
    html += '<div class="note">役満のため符は数えません。</div>';
  }

  // 点数
  html += '<div class="section-title">点数</div><div class="points-box">';
  const formula = correct.fu ? `${correct.han}翻 ${correct.fu}符` : `${correct.han}翻`;
  html += `<div class="formula">${formula} ／ ${correct.seat}の${correct.winType}`;
  if (correct.level) {
    html += `<span class="level">${withRuby(correct.level, correct.levelReading)}</span>`;
  }
  html += '</div>';
  html += `<div class="value">${correct.total.toLocaleString()}点</div>`;
  html += `<div class="detail">${correct.payment}</div>`;
  if (correct.levelDescription) {
    html += `<div class="detail">${correct.level}: ${correct.levelDescription}</div>`;
  }
  html += '<button type="button" class="ghost small" id="open-table">点数早見表で確かめる</button>';
  html += '</div>';

  if (correct.note) {
    html += `<div class="note"><b>ポイント:</b> ${correct.note}</div>`;
  }

  result.innerHTML = html;
  rubifyNode(result);
  el('open-table').addEventListener('click', () => {
    state.hintTab = 'table';
    if (el('hint').hidden) {
      openHint();
    } else {
      renderHint();
      el('hint').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  result.hidden = false;
  el('next-wrap').hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el('next').focus({ preventScroll: true });
}

/* --- 成績の表示 ---------------------------------------------------------- */

function renderStats() {
  const progress = state.progress;
  el('stat-total').textContent = progress.total;
  el('stat-perfect').textContent = progress.perfect;
  el('stat-streak').textContent = progress.streak;
  el('stat-review').textContent = progress.review.length;
  el('review-count').textContent = progress.review.length;

  [['rate-han', progress.han], ['rate-fu', progress.fu], ['rate-points', progress.points]]
    .forEach(([id, counter]) => {
      const rate = accuracy(counter);
      el(id).textContent = rate === null ? '—' : `${rate}%`;
      el(id).title = `${counter.ok} / ${counter.n} 問`;
    });

  // 復習待ちが無いときは復習モードを選べない
  const review = el('review');
  review.disabled = progress.review.length === 0 && !review.checked;
}

function resetProgress() {
  const ok = window.confirm('成績と復習リストをすべて消します。よろしいですか？');
  if (!ok) return;
  state.progress = clearProgress(STORAGE);
  el('review').checked = false;
  renderStats();
}

/* --- 通信 ---------------------------------------------------------------- */

/* 出題と採点の取得方法は QuizApi が握る。
   サーバー版は api-server.js、静的サイト版は api-static.js が定義する。 */

/** 復習リストから 1 問選ぶ（直前の問題はなるべく避ける）。取り出せない問題はリストから外す。 */
async function nextReviewProblem() {
  while (state.progress.review.length > 0) {
    const items = state.progress.review;
    const choices = items.length > 1 && state.problem
      ? items.filter((item) => item.id !== state.problem.id)
      : items;
    const item = choices[Math.floor(Math.random() * choices.length)];
    const problem = await QuizApi.problemById(item.id, item);
    if (problem) return problem;
    dropReviewItem(state.progress, item.id);
    saveProgress(state.progress, STORAGE);
  }
  return null;
}

async function loadProblem() {
  el('answer').hidden = true;
  el('result').hidden = true;
  el('next-wrap').hidden = true;
  el('board').innerHTML = '<div class="loading">読み込み中…</div>';

  try {
    let note = '';
    let data = null;
    if (el('review').checked) {
      data = await nextReviewProblem();
      if (!data) {
        el('review').checked = false;
        note = '復習待ちの問題がなくなったので、通常の出題に戻りました';
      }
    }
    state.isReview = data !== null;
    if (!data) {
      data = await QuizApi.nextProblem({
        difficulty: el('difficulty').value,
        preset: el('preset').checked,
      });
    }
    state.problem = data;
    renderProblem(data);
    resetForm();
    renderStats();
    el('settings-note').textContent = note;
    // 前の問題で押したボタンなどからフォーカスを外す。点数欄には自動で移らない
    // （数字キーはまず翻に入る。スマホではキーボードが開いて手牌が隠れるのも防ぐ）
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  } catch (error) {
    el('board').innerHTML = `<div class="loading">読み込みに失敗しました: ${error.message}</div>`;
  }
}

async function submitAnswer() {
  if (state.answered || !state.problem) return;
  lockForm();

  const data = await QuizApi.judge({
    problem: state.problem,
    han: state.han,
    fu: state.fu,
    points: el('points').value,
  });
  if (data.error) {
    el('result').innerHTML = `<div class="verdict ng">${data.error}</div>`;
    el('result').hidden = false;
    el('next-wrap').hidden = false;
    return;
  }
  renderResult(data);
}

/* --- 初期化 -------------------------------------------------------------- */

buildChips(el('han-chips'), HAN_CHOICES, (value) => { state.han = value; });
buildChips(el('fu-chips'), FU_CHOICES, (value) => { state.fu = value; });

document.querySelectorAll('#answer .term').forEach((button) => {
  button.addEventListener('click', () => toggleHelp(button));
});

el('points').addEventListener('input', updateSubmitState);
el('submit').addEventListener('click', submitAnswer);
el('giveup').addEventListener('click', submitAnswer);
el('hint-open').addEventListener('click', toggleHint);
el('next').addEventListener('click', loadProblem);

// 「-」「オール」ボタン。押しても入力欄のフォーカス（＝スマホのキーボード）を外さない
document.querySelectorAll('.insert').forEach((button) => {
  button.addEventListener('pointerdown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    const input = el('points');
    input.value += button.dataset.insert;
    updateSubmitState();
  });
});

// 難易度などの変更は次の問題から。答え合わせが済んでいれば、すぐ次の問題へ進む
function onSettingsChange() {
  if (state.answered || !state.problem) {
    loadProblem();
    return;
  }
  let label = el('difficulty').selectedOptions[0].textContent.replace(/（.*）/, '');
  if (el('preset').checked) label = '学習用の定義済み問題';
  if (el('review').checked) label = '間違えた問題の復習';
  el('settings-note').textContent = `次の問題から「${label}」になります`;
}
el('difficulty').addEventListener('change', onSettingsChange);
el('preset').addEventListener('change', onSettingsChange);
el('review').addEventListener('change', onSettingsChange);
el('reset-progress').addEventListener('click', resetProgress);

if (!QuizApi.supportsReview) el('review-option').hidden = true;
document.querySelectorAll('[data-ruby]').forEach(rubifyNode);
renderStats();

document.addEventListener('keydown', onKeydown);

loadProblem();
