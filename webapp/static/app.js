/* 麻雀 点数計算クイズ — フロントエンド
   採点はすべてサーバー（mahjong ライブラリ）が行う。ここは表示と入力だけ。 */

'use strict';

const HAN_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const FU_CHOICES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

const el = (id) => document.getElementById(id);

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
  stats: { total: 0, perfect: 0, streak: 0 },
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

  if (problem.title) {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = problem.title;
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
  button.setAttribute('aria-expanded', 'true');
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
    });
    container.appendChild(chip);
  });
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
  el('points').placeholder = problem.isTsumo
    ? problem.isDealer ? '◯◯オール' : '子から-親から'
    : '点数を入力';

  closeHelp();
  el('answer').hidden = false;
  el('result').hidden = true;
  el('next-wrap').hidden = true;
  updateSubmitState();
}

function lockForm() {
  state.answered = true;
  document.querySelectorAll('.chip').forEach((chip) => { chip.disabled = true; });
  el('points').disabled = true;
  el('submit').disabled = true;
  el('giveup').disabled = true;
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
  const perfect = data.hanOk && data.fuOk && data.pointsOk;
  const result = el('result');

  let html = '';
  html += `<div class="verdict ${perfect ? 'ok' : 'ng'}">`;
  html += perfect ? '正解！ すばらしい 🀄' : '惜しい！ 内訳を確認しましょう';
  html += '</div>';

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
  html += '</div>';

  if (correct.note) {
    html += `<div class="note"><b>ポイント:</b> ${correct.note}</div>`;
  }

  result.innerHTML = html;
  result.hidden = false;
  el('next-wrap').hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el('next').focus({ preventScroll: true });

  state.stats.total += 1;
  if (perfect) {
    state.stats.perfect += 1;
    state.stats.streak += 1;
  } else {
    state.stats.streak = 0;
  }
  el('stat-total').textContent = state.stats.total;
  el('stat-perfect').textContent = state.stats.perfect;
  el('stat-streak').textContent = state.stats.streak;
}

/* --- 通信 ---------------------------------------------------------------- */

/* 出題と採点の取得方法は QuizApi が握る。
   サーバー版は api-server.js、静的サイト版は api-static.js が定義する。 */

async function loadProblem() {
  el('answer').hidden = true;
  el('result').hidden = true;
  el('next-wrap').hidden = true;
  el('board').innerHTML = '<div class="loading">読み込み中…</div>';

  try {
    const data = await QuizApi.nextProblem({
      difficulty: el('difficulty').value,
      preset: el('preset').checked,
    });
    state.problem = data;
    renderProblem(data);
    resetForm();
    el('points').focus();
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
el('points').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !el('submit').disabled) submitAnswer();
});
el('submit').addEventListener('click', submitAnswer);
el('giveup').addEventListener('click', submitAnswer);
el('next').addEventListener('click', loadProblem);
el('difficulty').addEventListener('change', loadProblem);
el('preset').addEventListener('change', loadProblem);

document.addEventListener('keydown', (event) => {
  // 結果表示中は Enter / N で次の問題へ
  if (state.answered && (event.key === 'Enter' || event.key.toLowerCase() === 'n')) {
    loadProblem();
  }
});

loadProblem();
