#!/usr/bin/env python3
"""静的サイト（サーバー不要版）を docs/ に書き出す。

GitHub Pages で公開するための生成物を作る。やっていることは 2 つだけ。

1. 問題と答えを大量に事前生成して docs/data/problems.json に固める
   （翻・符・点数は mahjong ライブラリの計算結果そのもの）
2. webapp/static/ の画面ファイルを docs/ にコピーし、
   出題・採点の実装を api-server.js から api-static.js に差し替える

実行::

    .venv/bin/python build_static.py
    .venv/bin/python build_static.py --count 300   # 動作確認用に少なく
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import sys
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mahjong_quiz.presets import load_presets  # noqa: E402
from mahjong_quiz.problem import Problem, generate_problem  # noqa: E402
from mahjong_quiz.scoring import calculate  # noqa: E402
from mahjong_quiz.serialize import problem_to_dict, score_to_dict  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(ROOT, "webapp", "static")
OUTPUT_DIR = os.path.join(ROOT, "docs")

# 静的サイトに含める画面ファイル（api-server.js は差し替えるので含めない）
COPY_FILES = ["index.html", "style.css", "app.js", "quiz-core.js", "tileface.js", "tiles.html"]

# 難易度ごとの出題数の配分
DIFFICULTY_RATIO = {"easy": 0.3, "normal": 0.45, "hard": 0.25}


def build_entry(problem: Problem, problem_id: str) -> Dict[str, Any]:
    """1 問分の {問題, 答え} を作る。"""
    score = calculate(problem)
    return {
        "q": problem_to_dict(problem, problem_id, ask_fu=score.fu > 0),
        "a": score_to_dict(score, problem),
    }


def build_pool(count: int, seed: int) -> Dict[str, List[Dict[str, Any]]]:
    """問題プールを作る。定義済み問題と、難易度別のランダム問題。"""
    rng = random.Random(seed)
    pool: Dict[str, List[Dict[str, Any]]] = {
        "presets": [
            build_entry(problem, f"preset-{index}")
            for index, problem in enumerate(load_presets())
        ]
    }

    for difficulty, ratio in DIFFICULTY_RATIO.items():
        entries = []
        for index in range(round(count * ratio)):
            problem = generate_problem(rng=rng, difficulty=difficulty)
            entries.append(build_entry(problem, f"{difficulty}-{index}"))
        pool[difficulty] = entries
        print(f"  {difficulty:<6} {len(entries)} 問")

    print(f"  presets {len(pool['presets'])} 問")
    return pool


def copy_frontend() -> None:
    """画面ファイルをコピーし、出題・採点の実装を静的版に差し替える。"""
    for name in COPY_FILES:
        shutil.copy2(os.path.join(STATIC_DIR, name), os.path.join(OUTPUT_DIR, name))
    shutil.copy2(
        os.path.join(STATIC_DIR, "api-static.js"),
        os.path.join(OUTPUT_DIR, "api-static.js"),
    )

    index_path = os.path.join(OUTPUT_DIR, "index.html")
    with open(index_path, encoding="utf-8") as handle:
        html = handle.read()

    marker = '<script src="api-server.js"></script>'
    if marker not in html:
        raise SystemExit(
            f"index.html に {marker} が見つかりません。"
            "差し替え対象が変わっていないか確認してください。"
        )
    html = html.replace(marker, '<script src="api-static.js"></script>')

    with open(index_path, "w", encoding="utf-8") as handle:
        handle.write(html)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="静的サイトを docs/ に書き出す")
    parser.add_argument("--count", type=int, default=1500, help="ランダム問題の総数（既定: 1500）")
    parser.add_argument("--seed", type=int, default=2024, help="乱数シード（再現用）")
    args = parser.parse_args(argv)

    print(f"問題を生成しています（{args.count} 問）…")
    pool = build_pool(args.count, args.seed)

    os.makedirs(os.path.join(OUTPUT_DIR, "data"), exist_ok=True)
    data_path = os.path.join(OUTPUT_DIR, "data", "problems.json")
    with open(data_path, "w", encoding="utf-8") as handle:
        json.dump(pool, handle, ensure_ascii=False, separators=(",", ":"))

    copy_frontend()

    # GitHub Pages が _ 始まりのファイルを無視しないようにする（保険）
    open(os.path.join(OUTPUT_DIR, ".nojekyll"), "w").close()

    size_kb = round(os.path.getsize(data_path) / 1024)
    total = sum(len(entries) for entries in pool.values())
    print(f"\n完了: {OUTPUT_DIR}")
    print(f"  問題数 {total} 問 / problems.json {size_kb} KB")
    print("  確認: .venv/bin/python -m http.server -d docs 8000")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
