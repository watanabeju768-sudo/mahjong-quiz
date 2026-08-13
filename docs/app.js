/* 麻雀 点数計算クイズ — フロントエンド
   採点はすべてサーバー（mahjong ライブラリ）が行う。ここは表示と入力だけ。 */

'use strict';

const HAN_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const FU_CHOICES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

const el = (id) => document.getElementById(id);
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

  const badges = document.createElement('div');
  badges.className = 'badges';
  const items = [
    `${problem.roundWind}場`,
    `${problem.playerWind}家（${problem.seat}）`,
  ];
  items.forEach((text) => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = text;
    badges.appendChild(badge);
  });
  const winBadge = document.createElement('span');
  winBadge.className = 'badge strong';
  winBadge.textContent = problem.winType;
  badges.appendChild(winBadge);
  problem.conditions.forEach((text) => {
    const badge = document.createElement('span');
    badge.className = 'badge strong';
    badge.textContent = text;
    badges.appendChild(badge);
  });
  board.appendChild(badges);

  // ドラ表示牌
  const doraRow = document.createElement('div');
  doraRow.className = 'row';
  doraRow.innerHTML = '<div class="row-label">ドラ表示牌</div>';
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
  handRow.innerHTML = '<div class="row-label">手牌</div>';
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
    const label = document.createElement('span');
    label.className = 'meld-label';
    label.textContent = meld.type;
    group.appendChild(label);
    group.appendChild(tileRow(meld.tiles, { small: true }));
    handRow.appendChild(group);
  });

  board.appendChild(handRow);
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

  // 成立している役
  html += '<div class="section-title">成立している役</div><div class="yaku-list">';
  if (correct.yaku.length === 0) {
    html += '<span class="yaku-item">役なし</span>';
  }
  correct.yaku.forEach((yaku) => {
    html += `<span class="yaku-item">${withRuby(yaku.name, yaku.reading)}<b>${yaku.han}翻</b></span>`;
  });
  if (correct.dora > 0) {
    html += `<span class="yaku-item dora">ドラ<b>${correct.dora}翻</b></span>`;
  }
  html += `<span class="yaku-item"><b>合計 ${correct.han}翻</b></span>`;
  html += '</div>';

  // 符の内訳
  if (correct.fuDetails.length > 0) {
    html += '<div class="section-title">符計算の内訳</div><table class="fu">';
    correct.fuDetails.forEach((detail) => {
      html += `<tr><td>${withRuby(detail.reason, detail.reading)}</td>`;
      html += `<td class="num">${detail.fu}符</td></tr>`;
    });
    if (correct.fuRaw !== correct.fu) {
      html += `<tr class="total"><td>小計 ${correct.fuRaw}符 → 切り上げ</td>`;
      html += `<td class="num">${correct.fu}符</td></tr>`;
    } else {
      html += `<tr class="total"><td>合計</td><td class="num">${correct.fu}符</td></tr>`;
    }
    html += '</table>';
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
