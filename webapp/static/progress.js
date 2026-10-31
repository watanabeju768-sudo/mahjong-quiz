/* 成績と復習リストを、この端末のブラウザ（localStorage）に保存する。
   ほかの端末やブラウザとは共有されない。保存できない環境（プライベート
   ブラウズなど）でも動くよう、読み書きの失敗は握りつぶして空の成績で続ける。

   表示や出題には依存しない純粋な関数だけを置き、Node のテスト
   （tests/test_progress.mjs）から直接呼べるようにしてある。 */

'use strict';

const PROGRESS_KEY = 'mahjong-quiz:progress:v1';
const MAX_REVIEW_ITEMS = 200;   // 復習リストの上限（古いものから捨てる）

function emptyProgress() {
  return {
    total: 0,       // 解いた数（ヒントあり・わからないも含む）
    perfect: 0,     // ヒントなしで翻・符・点数すべて正解した数
    streak: 0,      // ヒントなし全問正解の連続数
    hinted: 0,      // ヒントを使った数
    // 項目別の正解数 / 回答数。ヒントを使った問題は数えない
    han: { ok: 0, n: 0 },
    fu: { ok: 0, n: 0 },
    points: { ok: 0, n: 0 },
    // 復習待ち。問題 ID と、取り違え防止の答え（翻・符・点数）を持つ
    review: [],
  };
}

function loadProgress(storage) {
  try {
    const raw = storage ? storage.getItem(PROGRESS_KEY) : null;
    if (!raw) return emptyProgress();
    const saved = JSON.parse(raw);
    const progress = Object.assign(emptyProgress(), saved);
    if (!Array.isArray(progress.review)) progress.review = [];
    return progress;
  } catch (error) {
    return emptyProgress();
  }
}

function saveProgress(progress, storage) {
  try {
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch (error) {
    return false;
  }
}

function clearProgress(storage) {
  try {
    if (storage) storage.removeItem(PROGRESS_KEY);
  } catch (error) {
    // 消せなくても画面上の成績は空に戻すので、ここでは何もしない
  }
  return emptyProgress();
}

function tally(counter, ok) {
  counter.n += 1;
  if (ok) counter.ok += 1;
}

/**
 * 1 問の結果を記録する（progress を書き換える）。
 * result は { id, hanOk, fuOk, pointsOk, askFu, hintUsed, correct: { han, fu, total } }。
 * 1 つでも間違えた問題・ヒントを使った問題は復習リストへ入れ、
 * ヒントなしで全問正解した問題はリストから外す。
 * 戻り値は { perfect, inReview, wasInReview }。
 */
function recordResult(progress, result) {
  const perfect = Boolean(result.hanOk && result.fuOk && result.pointsOk);
  const clean = perfect && !result.hintUsed;

  progress.total += 1;
  if (result.hintUsed) {
    progress.hinted += 1;
  } else {
    tally(progress.han, result.hanOk);
    if (result.askFu) tally(progress.fu, result.fuOk);
    tally(progress.points, result.pointsOk);
  }

  if (clean) {
    progress.perfect += 1;
    progress.streak += 1;
  } else if (!perfect) {
    progress.streak = 0;
  }

  const wasInReview = progress.review.some((item) => item.id === result.id);
  progress.review = progress.review.filter((item) => item.id !== result.id);
  if (!clean) {
    progress.review.push({
      id: result.id,
      han: result.correct.han,
      fu: result.correct.fu,
      total: result.correct.total,
    });
    if (progress.review.length > MAX_REVIEW_ITEMS) {
      progress.review = progress.review.slice(-MAX_REVIEW_ITEMS);
    }
  }
  return { perfect: perfect, inReview: !clean, wasInReview: wasInReview };
}

/** 復習リストから 1 件外す（問題が見つからなかったときなど）。 */
function dropReviewItem(progress, id) {
  progress.review = progress.review.filter((item) => item.id !== id);
}

/** 正解率（%）。まだ回答がなければ null。 */
function accuracy(counter) {
  return counter.n === 0 ? null : Math.round((counter.ok / counter.n) * 100);
}

// Node のテストから読めるようにする（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PROGRESS_KEY,
    emptyProgress,
    loadProgress,
    saveProgress,
    clearProgress,
    recordResult,
    dropReviewItem,
    accuracy,
  };
}
