/* 点数の回答を解析して正誤を判定する。
   mahjong_quiz/quiz.py の parse_points / check_points の移植版で、
   静的サイト版（サーバーなし）で使う。両者の挙動は
   tests/points_cases.json を Python と Node の両方から流して検証している。

   ※ 点数計算そのものは移植していない。翻・符・点数は Python 側で
      mahjong ライブラリが計算した結果を JSON に固めて配布する。 */

'use strict';

const ALL_SUFFIX = /^(\d+)(?:オール|オ-ル|all)$/i;
const SPLIT_PAYMENT = /^(\d+)\s*[/／\-ー]\s*(\d+)$/;
const PLAIN_NUMBER = /^(\d+)$/;

/**
 * 点数の回答を解析する。
 *   "7700"       → { total: 7700 }      合計点
 *   "2000オール"  → { each: 2000 }       親のツモ（子 1 人あたり）
 *   "1300-2600"  → { child: 1300, dealer: 2600 }  子のツモ
 * 解釈できなければ null。
 */
function parsePoints(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/,/g, '')
    .replace(/点/g, '')
    .replace(/\s/g, '');
  if (!cleaned) return null;

  let match = cleaned.match(ALL_SUFFIX);
  if (match) return { each: Number(match[1]) };

  match = cleaned.match(SPLIT_PAYMENT);
  if (match) return { child: Number(match[1]), dealer: Number(match[2]) };

  match = cleaned.match(PLAIN_NUMBER);
  if (match) return { total: Number(match[1]) };

  return null;
}

/**
 * 解析した回答が正しいか判定する。
 * correct は { isTsumo, isDealer, total, main, additional }。
 */
function checkPoints(answer, correct) {
  if (!answer) return false;

  if (answer.total !== undefined) {
    return answer.total === correct.total;
  }
  if (answer.each !== undefined) {
    return Boolean(correct.isTsumo && correct.isDealer && answer.each === correct.main);
  }
  if (answer.child !== undefined && answer.dealer !== undefined) {
    if (!correct.isTsumo) return false;
    if (correct.isDealer) {
      // 親のツモは全員同額。"4000/4000" のような書き方も許容する。
      return answer.child === answer.dealer && answer.child === correct.main;
    }
    return answer.child === correct.additional && answer.dealer === correct.main;
  }
  return false;
}

/** 問題と回答から、サーバー版と同じ形の採点結果を組み立てる。 */
function judgeLocally(entry, input) {
  const correct = entry.a;
  const askFu = entry.q.askFu;
  const parsed = input.points ? parsePoints(input.points) : null;

  return {
    hanOk: input.han !== null && input.han === correct.han,
    fuOk: !askFu || (input.fu !== null && input.fu === correct.fu),
    pointsOk: parsed !== null && checkPoints(parsed, correct),
    askFu: askFu,
    yourPoints: String(input.points || '').trim(),
    pointsParsed: parsed !== null,
    correct: correct,
  };
}

/* 点数早見表（ヒント）用に、翻・符から支払いを求める。
   採点には使わない（採点はあくまで mahjong ライブラリの計算結果）。
   値は tests/score_table_cases.json（ライブラリの計算結果）と Node のテストで照合している。 */
const LIMIT_BASE_POINTS = [[13, 8000], [11, 6000], [8, 4000], [6, 3000], [5, 2000]];

function roundUp100(value) {
  return Math.ceil(value / 100) * 100;
}

/**
 * 翻・符・親子・ツモ/ロンから支払いを返す。形は採点データと同じ
 * { main, additional, total }（ロン=main が総点、子のツモ=main が親の支払い）。
 */
function scoreFor(han, fu, isDealer, isTsumo) {
  const limit = LIMIT_BASE_POINTS.find(([minHan]) => han >= minHan);
  const base = limit ? limit[1] : Math.min(fu * 2 ** (2 + han), 2000);

  if (!isTsumo) {
    const main = roundUp100(base * (isDealer ? 6 : 4));
    return { main: main, additional: 0, total: main };
  }
  if (isDealer) {
    const each = roundUp100(base * 2);
    return { main: each, additional: each, total: each * 3 };
  }
  const main = roundUp100(base * 2);
  const additional = roundUp100(base);
  return { main: main, additional: additional, total: main + additional * 2 };
}

// Node のテストから読めるようにする（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parsePoints, checkPoints, judgeLocally, scoreFor };
}
