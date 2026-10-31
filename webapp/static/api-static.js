/* 静的サイト版の出題・採点。
   build_static.py が事前に生成した data/problems.json を読み込み、
   ブラウザだけで完結させる（サーバー不要）。

   翻・符・点数は Python 側で mahjong ライブラリが計算した結果であり、
   ここでは「どの問題を出すか」と「回答が合っているか」だけを扱う。 */

'use strict';

const POOL_URL = 'data/problems.json';

let poolPromise = null;
const shuffled = {};   // 難易度ごとの出題順（一周するまで重複させない）
const cursor = {};
const answers = {};    // 問題 ID → 正解データ

function loadPool() {
  if (!poolPromise) {
    poolPromise = fetch(POOL_URL).then((response) => {
      if (!response.ok) throw new Error(`問題データを読み込めませんでした (${response.status})`);
      return response.json();
    });
  }
  return poolPromise;
}

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const QuizApi = {
  supportsReview: true,

  /**
   * 復習用に、問題 ID から 1 問取り出す。expected（翻・符・点数）が答えと
   * 食い違えば、問題データが作り直されて別の問題になったとみなして null を返す。
   */
  async problemById(id, expected) {
    const pool = await loadPool();
    for (const entries of Object.values(pool)) {
      const entry = entries.find((item) => item.q.id === id);
      if (!entry) continue;
      if (expected && (entry.a.han !== expected.han || entry.a.fu !== expected.fu
        || entry.a.total !== expected.total)) {
        return null;
      }
      answers[id] = entry;
      return entry.q;
    }
    return null;
  },

  async nextProblem({ difficulty, preset }) {
    const pool = await loadPool();
    const key = preset ? 'presets' : difficulty;
    const entries = pool[key];
    if (!entries || entries.length === 0) {
      throw new Error(`問題が見つかりません: ${key}`);
    }

    if (!shuffled[key] || cursor[key] >= shuffled[key].length) {
      shuffled[key] = shuffle(entries);
      cursor[key] = 0;
    }
    const entry = shuffled[key][cursor[key]];
    cursor[key] += 1;

    answers[entry.q.id] = entry;
    return entry.q;
  },

  async judge({ problem, han, fu, points }) {
    const entry = answers[problem.id];
    if (!entry) return { error: '問題が見つかりません。次の問題に進んでください。' };
    return judgeLocally(entry, { han: han, fu: fu, points: points });
  },
};
