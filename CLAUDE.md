# CLAUDE.md

麻雀の「役」と「点数計算（符・翻・点数）」を学ぶための CUI クイズアプリ。
このファイルは Claude Code がこのリポジトリで作業するときの指針。

## 実行コマンド

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

```bash
.venv/bin/python main.py
```

| コマンド | 内容 |
| --- | --- |
| `.venv/bin/python webapp/server.py` | **ブラウザ版**（既定 http://127.0.0.1:8765/ ） |
| `.venv/bin/python webapp/server.py --port 9000 --no-browser` | ポート変更・自動で開かない |
| `.venv/bin/python main.py` | ターミナル版・ランダム 5 問 |
| `.venv/bin/python main.py -n 10 -d easy` | やさしい手を 10 問 |
| `.venv/bin/python main.py --preset` | 定義済みの学習用問題から出題 |
| `.venv/bin/python main.py --batch` | 翻・符・点数を 1 行でまとめて回答 |
| `.venv/bin/python main.py --seed 42` | 同じ問題を再現（バグ報告時に使う） |
| `.venv/bin/python build_static.py` | **公開用の静的サイトを docs/ に生成** |
| `.venv/bin/python -m http.server -d docs 8000` | 生成した静的サイトの確認 |
| `.venv/bin/python -m unittest discover -s tests` | テスト実行（Python） |
| `node tests/test_points.mjs` | テスト実行（JS の回答判定） |

回答中は `q` で終了、空行で降参（答えと解説を表示）。

## 開発環境

- Python 3.9（macOS のシステム Python）。**3.9 で動く構文を保つこと**
  — `list[int]` などの組み込みジェネリクスは実行時に評価させない
  （各モジュール冒頭の `from __future__ import annotations` が前提）。
- 依存は `mahjong` 1.4.0 のみ（`requirements.txt` で `==1.4.0` に固定）。
  2.x は役名の英語表記が変わり（例: `Yakuhai (seat wind east)`）、`naming.py` の
  対応表から外れて英語のまま表示されるため、上げるときは対応表ごと見直す。
  追加の依存は `requirements.txt` に明記する。
- Windows では仮想環境の Python は `.venv/Scripts/python`（macOS は `.venv/bin/python`）。

## ディレクトリ構成

```
main.py                  CLI エントリポイント（argparse だけ）
mahjong_quiz/            ← 表示層に依存しない中核。CUI とブラウザで共有する
  tiles.py               34/136 形式の変換、牌の日本語表示、ドラ計算
  naming.py              英語→日本語の対応表（役名・符の理由・満貫の呼び名）
  scoring.py             mahjong ライブラリのラッパー。Score データクラス
  problem.py             Problem データクラス、文字列からの生成、ランダム生成
  presets.py             学習用の定義済み問題
  quiz.py                CUI の出題ループ・回答判定・解説表示
  serialize.py           Problem / Score → Web 向け dict
webapp/
  server.py              標準ライブラリだけの HTTP サーバー（JSON API ＋ 静的配信）
  static/index.html      画面
  static/style.css       配色・牌の下地（象牙色・厚み）
  static/tileface.js     牌の絵柄を描く SVG ジェネレータ
  static/app.js          出題の描画・入力・結果表示
  static/api-server.js   出題・採点をサーバーに問い合わせる実装
  static/api-static.js   出題・採点をブラウザだけで完結させる実装（静的版）
  static/quiz-core.js    回答の解析・正誤判定（quiz.py の移植、静的版で使う）
  static/tiles.html      牌 34 種を並べた開発用ページ（/tiles.html）
build_static.py          公開用の静的サイトを docs/ に書き出す
docs/                    ← 生成物。GitHub Pages がここを公開する（コミットする）
tests/test_scoring.py    unittest（pytest 不要）
tests/test_points.mjs    JS の回答判定のテスト（node で実行）
tests/points_cases.json  Python と JS の共通テストケース
```

## 設計方針

- **点数計算のロジックを自前で書かない。** 符・翻・点数はすべて
  `mahjong.hand_calculating.hand.HandCalculator` に計算させる。
  このリポジトリの役割は「出題」と「日本語での解説」に限る。
- **英語→日本語の変換は `naming.py` に集約する。** 役名や符の理由を
  他のモジュールにハードコードしない。ライブラリを更新して未知の役名が
  出た場合は、変換せずそのまま表示される（落ちない）ようにしてある。
- **日本語名には必ず読みを付ける。** `naming.py` の `YAKU_JA` /
  `FU_REASON_JA` / `YAKU_LEVEL_JA` に名前を足したら、対応する
  `*_READING` にも読み（カタカナ）を足す。付け忘れは
  `test_every_japanese_name_has_a_reading` が検出する。
  読みを添えて表示するので、**名前に説明の括弧書きを入れない**
  （「副底（基本符）（フーテイ）」のように括弧が重なるため）。
  表示は CUI が「平和（ピンフ）」、ブラウザ版が ruby タグのふりがな。
- **役名・符の理由には初心者向けの説明も付ける。** `YAKU_JA` / `FU_REASON_JA`
  に足したら `YAKU_DESCRIPTION` / `FU_REASON_DESCRIPTION` にもひとこと説明を足す
  （付け忘れは `test_every_japanese_name_has_a_description` が検出）。
  副底は符の値（20/25/30）で意味が変わるので `FU_BASE_DESCRIPTION` で引き分ける。
  問題画面の「？」で出す用語（場風・ドラ表示牌・ポンなど）は `app.js` の `GLOSSARY`。
- **符の内訳の「どの牌か」は対応付けるだけで、符は計算し直さない。**
  `scoring._fu_source_tiles()` がライブラリ自身の手牌分解と符計算を呼び直し、
  応答とまったく同じ内訳になる分解から牌を拾う。見つからなければ牌の表示を省く。
- **ランダム生成は「作って検証する」方式。** `problem.py` の
  `generate_problem()` は適当な和了形を組んでから採点し、役なしなら捨てて
  作り直す。ここで手役の成立条件を推論しないこと。
- **表示と判定を分ける。** `quiz.py` の `format_problem` /
  `format_explanation` / `check_points` は副作用のない純粋関数にしてある。
  テストしやすさのためにこの分離は保つ。
- **`mahjong_quiz/` は表示層に依存しない。** CUI（`quiz.py`）もブラウザ版
  （`webapp/`）も同じ `problem` / `scoring` を呼ぶ。回答の書式判定
  （`quiz.parse_points` / `quiz.check_points`）はサーバー側でも再利用しており、
  ここを直せば両方に効く。答えはクライアントに送らず、サーバーが問題 ID で
  保持している（`webapp/server.py` の `_problems`）。
- **入力例に実在しそうな点数を書かない。** 「例: 1300-2600」のような
  プレースホルダは、そのまま正解になってしまうことがある。書式だけを示すこと。

### 牌の絵柄（`webapp/static/tileface.js`）

- 牌 1 枚は「CSS の下地（象牙色・角丸・厚み）＋ SVG の絵柄」の二層。
  SVG 側は背景を描かないので、`id` の衝突や配色の二重管理が起きない。
- 座標系は `viewBox="0 0 60 84"`、絵柄を置くのは x:6-54 / y:6-78。
- 筒子・索子の配置と配色は `PIN_LAYOUTS` / `PIN_COLORS` /
  `SOU_LAYOUTS` / `SOU_RED_INDEXES` の表を書き換えるだけで調整できる。
- 変更したら `/tiles.html` で 34 種すべてを目視確認する。

### 牌の表現

- 34 形式 = 牌の種類（0-8:萬子 / 9-17:筒子 / 18-26:索子 / 27-33:東南西北白發中）
- 136 形式 = 4 枚を区別した実体。`tile136 // 4 == tile34`
- 副露牌も含めた 14 枚を `Problem.tiles136` に持ち、
  `HandCalculator.estimate_hand_value()` にもその 14 枚を渡す（ライブラリの仕様）。

## 採用ルール（`scoring.DEFAULT_RULES`）

- 喰いタンあり / 赤ドラなし / 平和ツモは 20 符 / 喰い平和形は 30 符 / 数え役満あり
- ルールを増やすときは `OptionalRules` の引数として `DEFAULT_RULES` に足し、
  CLI から切り替えられるようにする（現状はハードコード）。

## 今後の開発方針

優先度順:

1. **赤ドラ対応** — `OptionalRules(has_aka_dora=True)` と、136 形式での
   赤牌の扱い（各スート 5 の特定インデックス）を `tiles.py` に追加する。
2. **裏ドラ・一発・海底などの状況** — `HandConfig` にはすでに引数がある。
   `Problem` にフィールドを足し、出題時にランダムで付与する。
3. **役別の出題モード** — 「平和だけ」「符計算だけ」など、`presets.py` に
   タグを持たせて絞り込めるようにする。
4. **成績の永続化** — 間違えた問題を JSON に貯めて復習モードで再出題する。
   保存先は `~/.mahjong_quiz/` を想定。
5. **ブラウザ版の強化** — 成績グラフ、間違えた問題の復習、牌をクリックしての
   面子分解表示など。サーバーは標準ライブラリだけで書いてあるので、
   フレームワークを入れる場合は `requirements.txt` と合わせて検討する。

## 公開（GitHub Pages）

- 公開しているのは `docs/` の中身だけ。`build_static.py` が
  `webapp/static/` の画面ファイルをコピーし、`index.html` の
  `<script src="api-server.js">` を `api-static.js` に差し替えて作る。
  **画面を直すときは `webapp/static/` を編集する。`docs/` は毎回上書きされる。**
- 静的版はサーバーがないので、回答の正誤判定を JS 側（`quiz-core.js`）でも
  持っている。`quiz.py` の `parse_points` / `check_points` を変えたら
  `quiz-core.js` も同じように直し、`tests/points_cases.json` にケースを足して
  **Python と Node の両方のテストを通す**こと。
- 画面ファイルのパスは**すべて相対パス**にする。GitHub Pages は
  `https://<ユーザー名>.github.io/mahjong-quiz/` のようにサブパスで配信されるため、
  `/style.css` のような絶対パスは 404 になる。
- 内容を更新したら `build_static.py` を実行し直し、`docs/` ごとコミットして
  push する（push した数十秒後に反映される）。

## 作業時の注意

- 問題を追加したら `tests/test_scoring.py` の `test_all_presets_are_scorable`
  が通ることを確認する（役なしの手を preset に入れると落ちる）。
- 生成器を触ったら `--seed` を固定して出題内容が壊れていないか目視する。
- 点数の答え合わせは合計点だけでなく「1300/2600」「2000オール」の表記も
  受け付ける（`quiz.parse_points`）。表記を増やすときはテストも足す。
