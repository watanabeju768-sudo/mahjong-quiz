/* 成績・復習リストの記録（webapp/static/progress.js）のテスト。

   実行:  node tests/test_progress.mjs
*/

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  PROGRESS_KEY, emptyProgress, loadProgress, saveProgress, clearProgress,
  recordResult, dropReviewItem, accuracy,
} = require(join(here, '..', 'webapp', 'static', 'progress.js'));

/** localStorage の代わり。 */
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
    data,
  };
}

const answer = { han: 2, fu: 30, total: 2000 };
const result = (overrides) => ({
  id: 'normal-1', hanOk: true, fuOk: true, pointsOk: true, askFu: true, hintUsed: false,
  correct: answer, ...overrides,
});

const tests = {
  '全問正解は成績に数え、復習には入れない'() {
    const progress = emptyProgress();
    const outcome = recordResult(progress, result());
    assert.equal(outcome.perfect, true);
    assert.equal(outcome.inReview, false);
    assert.deepEqual([progress.total, progress.perfect, progress.streak], [1, 1, 1]);
    assert.deepEqual(progress.review, []);
  },

  '1 つでも間違えたら復習に入り、連続が途切れる'() {
    const progress = emptyProgress();
    recordResult(progress, result({ id: 'a' }));
    recordResult(progress, result({ id: 'b', fuOk: false }));
    assert.equal(progress.streak, 0);
    assert.deepEqual(progress.review, [{ id: 'b', han: 2, fu: 30, total: 2000 }]);
    assert.deepEqual(progress.fu, { ok: 1, n: 2 });
    assert.deepEqual(progress.han, { ok: 2, n: 2 });
  },

  'ヒントあり正解は復習に入り、正解率・全問正解には数えず、連続も途切れさせない'() {
    const progress = emptyProgress();
    recordResult(progress, result({ id: 'a' }));
    const outcome = recordResult(progress, result({ id: 'b', hintUsed: true }));
    assert.equal(outcome.inReview, true);
    assert.deepEqual([progress.perfect, progress.streak, progress.hinted], [1, 1, 1]);
    assert.deepEqual(progress.han, { ok: 1, n: 1 });
    assert.equal(progress.review.length, 1);
  },

  'ヒントなしで全問正解したら復習から外れる'() {
    const progress = emptyProgress();
    recordResult(progress, result({ pointsOk: false }));
    const outcome = recordResult(progress, result());
    assert.equal(outcome.wasInReview, true);
    assert.deepEqual(progress.review, []);
  },

  '同じ問題をまた間違えても復習リストで重複しない'() {
    const progress = emptyProgress();
    recordResult(progress, result({ id: 'a', hanOk: false }));
    recordResult(progress, result({ id: 'b', hanOk: false }));
    recordResult(progress, result({ id: 'a', hanOk: false }));
    assert.deepEqual(progress.review.map((item) => item.id), ['b', 'a']);
  },

  '符を聞かない問題（役満）は符の回答数に入れない'() {
    const progress = emptyProgress();
    recordResult(progress, result({ askFu: false }));
    assert.deepEqual(progress.fu, { ok: 0, n: 0 });
  },

  '保存して読み直すと同じ成績になる'() {
    const storage = memoryStorage();
    const progress = emptyProgress();
    recordResult(progress, result({ hanOk: false }));
    assert.equal(saveProgress(progress, storage), true);
    assert.deepEqual(loadProgress(storage), progress);
  },

  '壊れたデータや保存できない環境でも空の成績で動く'() {
    assert.deepEqual(loadProgress(memoryStorage({ [PROGRESS_KEY]: '{oops' })), emptyProgress());
    assert.deepEqual(loadProgress(null), emptyProgress());
    const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.deepEqual(loadProgress(throwing), emptyProgress());
    assert.equal(saveProgress(emptyProgress(), throwing), false);
  },

  'リセットで保存データが消える'() {
    const storage = memoryStorage();
    saveProgress(emptyProgress(), storage);
    assert.deepEqual(clearProgress(storage), emptyProgress());
    assert.equal(storage.getItem(PROGRESS_KEY), null);
  },

  '復習リストから 1 件外せる・正解率は回答がなければ null'() {
    const progress = emptyProgress();
    recordResult(progress, result({ id: 'a', hanOk: false }));
    dropReviewItem(progress, 'a');
    assert.deepEqual(progress.review, []);
    assert.equal(accuracy({ ok: 0, n: 0 }), null);
    assert.equal(accuracy({ ok: 2, n: 3 }), 67);
  },
};

for (const [name, run] of Object.entries(tests)) {
  run();
}
console.log(`OK — 成績・復習の記録 ${Object.keys(tests).length} 件が通りました (JS)`);
