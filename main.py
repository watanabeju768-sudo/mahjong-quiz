#!/usr/bin/env python3
"""麻雀 点数計算クイズ（CUI）のエントリポイント。

使い方::

    python main.py                    # ランダム 5 問
    python main.py --count 10         # 10 問
    python main.py --preset           # 定義済みの学習用問題から出題
    python main.py --difficulty easy  # 門前・4翻までのやさしい手
    python main.py --batch            # 翻・符・点数を 1 行でまとめて回答
"""

from __future__ import annotations

import argparse
import sys

from mahjong_quiz.problem import DIFFICULTIES
from mahjong_quiz.quiz import run


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="麻雀の役と点数計算（符・翻・点数）を練習するクイズ",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("-n", "--count", type=int, default=5, help="出題数（既定: 5）")
    parser.add_argument(
        "-d",
        "--difficulty",
        choices=DIFFICULTIES,
        default="normal",
        help="難易度（既定: normal）",
    )
    parser.add_argument(
        "-p", "--preset", action="store_true", help="定義済みの学習用問題を優先して出題する"
    )
    parser.add_argument(
        "-b", "--batch", action="store_true", help="翻・符・点数を 1 行でまとめて回答する"
    )
    parser.add_argument("--seed", type=int, default=None, help="乱数シード（再現用）")
    parser.add_argument("--no-color", action="store_true", help="色付けを無効にする")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    if args.count < 1:
        print("出題数は 1 以上を指定してください", file=sys.stderr)
        return 1

    run(
        count=args.count,
        difficulty=args.difficulty,
        use_presets=args.preset,
        batch=args.batch,
        seed=args.seed,
        color=not args.no_color,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
