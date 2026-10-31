/* JS 版（webapp/static/quiz-core.js）の回答判定を、Python 版と共通の
   テストケース（tests/points_cases.json）で検証する。
   ヒントの点数早見表（scoreFor）も、ライブラリの計算結果
   （tests/score_table_cases.json）と一致することを確かめる。

   実行:  node tests/test_points.mjs
*/

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { parsePoints, checkPoints, scoreFor } = require(join(here, '..', 'webapp', 'static', 'quiz-core.js'));

const cases = JSON.parse(readFileSync(join(here, 'points_cases.json'), 'utf8'));

let passed = 0;

for (const item of cases.parse) {
  const actual = parsePoints(item.text);
  assert.deepEqual(actual, item.expected, `parsePoints(${JSON.stringify(item.text)})`);
  passed += 1;
}

for (const item of cases.check) {
  const score = cases.scores[item.score];
  assert.ok(score, `未定義のスコア: ${item.score}`);
  const actual = checkPoints(parsePoints(item.text), score);
  assert.equal(actual, item.expected, `checkPoints(${item.score}, ${JSON.stringify(item.text)})`);
  passed += 1;
}

const scoreCases = JSON.parse(readFileSync(join(here, 'score_table_cases.json'), 'utf8'));
for (const item of scoreCases.cases) {
  const actual = scoreFor(item.han, item.fu, item.isDealer, item.isTsumo);
  assert.deepEqual(
    actual,
    { main: item.main, additional: item.additional, total: item.total },
    `scoreFor(${item.han}翻 ${item.fu}符 ${item.isDealer ? '親' : '子'} ${item.isTsumo ? 'ツモ' : 'ロン'})`,
  );
  passed += 1;
}

console.log(`OK — ${passed} 件の共通ケースが通りました (JS)`);
