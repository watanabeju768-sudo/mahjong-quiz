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

// Node のテストから読めるようにする（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parsePoints, checkPoints, judgeLocally };
}
