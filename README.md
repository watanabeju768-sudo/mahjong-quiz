# 麻雀 点数計算クイズ 🀄

麻雀の「役」と「点数計算（符・翻・点数）」をブラウザで練習できるクイズアプリです。
役判定と点数計算は [mahjong](https://github.com/MahjongRepository/mahjong) ライブラリ（MIT License）が
行っているので、表示される正解は実戦のルールどおりです。

**▶ 公開 URL: https://watanabeju768-sudo.github.io/mahjong-quiz/**

## できること

- 和了り形・ドラ・場風/自風・ツモ/ロンを見て、**翻数 → 符 → 点数**を答える
- 間違えると、成立している役・符の内訳・点数の計算過程を解説
- 役名や符の用語には**ふりがな付き**（三暗刻→サンアンコー、副底→フーテイ など）
- 役・符の各行に**ひとこと解説**。符はこの手のどの牌から付いたかも表示。場風・ドラ表示牌などは「？」で説明
- 解答中に**ヒント**（符計算の手順表・点数早見表）を開ける。使った問題は「ヒントあり」として記録
- **キーボードだけで解ける**（数字キーで翻→符、点数を入れて Enter、H でヒント）
- 牌は萬子・筒子・索子・字牌それぞれ実物と同じ絵柄で表示
- 難易度 3 段階（やさしい / ふつう / むずかしい）と、学習用の定義済み問題
- ダーク／ライトモード自動対応、スマホでも遊べます

点数は `3900` / `2000オール` / `1300-2600` のどの書き方でも受け付けます。

## 遊び方（ローカル）

### ブラウザ版

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

```bash
.venv/bin/python webapp/server.py
```

ブラウザが開きます。止めるときは `Ctrl+C`。

### ターミナル版

```bash
.venv/bin/python main.py --preset
```

| オプション | 内容 |
| --- | --- |
| `-n, --count N` | 出題数（既定 5） |
| `-d, --difficulty easy\|normal\|hard` | 難易度 |
| `-p, --preset` | 学習用の定義済み問題から出題 |
| `-b, --batch` | `4,30,7700` のように 1 行でまとめて回答 |
| `--seed N` | 乱数シードを固定して同じ問題を再現 |

回答中は `q` で終了、空行で降参（答えと解説を表示）。

## 公開用の静的サイトを作る

```bash
.venv/bin/python build_static.py
```

問題と答えを事前に生成して `docs/` に静的サイトを書き出します（サーバー不要）。
GitHub Pages はこの `docs/` フォルダを公開します。手元での確認は次のとおり。

```bash
.venv/bin/python -m http.server -d docs 8000
```

## 採用ルール

喰いタンあり / 赤ドラなし / 平和ツモ 20 符 / 喰い平和形 30 符 / 数え役満あり

## テスト

```bash
.venv/bin/python -m unittest discover -s tests -v
```

```bash
node tests/test_points.mjs
```

点数の回答判定は Python 版と JavaScript 版の 2 つがあるため、
`tests/points_cases.json` の共通ケースを両方から流して挙動を突き合わせています。

## ライセンス

MIT License（[LICENSE](LICENSE)）。
役判定・点数計算に [mahjong](https://github.com/MahjongRepository/mahjong)（MIT License, Copyright (c) 2017 Alexey Lisikhin）を利用しています。
