"""ブラウザ版のローカルサーバー（標準ライブラリのみ）。

役判定・点数計算は CUI 版とまったく同じ mahjong_quiz パッケージを使う。
このファイルの役割は HTTP と JSON の受け渡しだけ。

起動::

    .venv/bin/python webapp/server.py
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import random
import sys
import uuid
import webbrowser
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mahjong_quiz.presets import load_presets  # noqa: E402
from mahjong_quiz.problem import DIFFICULTIES, Problem, generate_problem  # noqa: E402
from mahjong_quiz.quiz import check_points, parse_points  # noqa: E402
from mahjong_quiz.scoring import calculate  # noqa: E402
from mahjong_quiz.serialize import problem_to_dict, score_to_dict  # noqa: E402

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# 出題済みの問題を保持する。答えをクライアントに渡さないためのサーバー側の控え。
MAX_CACHED_PROBLEMS = 300
_problems: "OrderedDict[str, Problem]" = OrderedDict()
_rng = random.Random()

# 定義済み問題は 1 周するまで重複させない
_preset_queue: list = []


def _remember(problem: Problem) -> str:
    problem_id = uuid.uuid4().hex
    _problems[problem_id] = problem
    while len(_problems) > MAX_CACHED_PROBLEMS:
        _problems.popitem(last=False)
    return problem_id


def _next_problem(difficulty: str, use_presets: bool) -> Problem:
    """次に出題する問題を選ぶ。"""
    global _preset_queue
    if use_presets:
        if not _preset_queue:
            _preset_queue = load_presets()
            _rng.shuffle(_preset_queue)
        return _preset_queue.pop()
    return generate_problem(rng=_rng, difficulty=difficulty)


def build_problem_payload(difficulty: str, use_presets: bool) -> Dict[str, Any]:
    """出題用の JSON を作る。"""
    problem = _next_problem(difficulty, use_presets)
    score = calculate(problem)  # 生成時点で必ず成立することを確認しておく
    problem_id = _remember(problem)
    return problem_to_dict(problem, problem_id, ask_fu=score.fu > 0)


def build_answer_payload(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """回答を採点して JSON を作る。戻り値は (HTTP ステータス, 本文)。"""
    problem = _problems.get(body.get("id"))
    if problem is None:
        return 404, {"error": "問題が見つかりません。次の問題に進んでください。"}

    score = calculate(problem)
    ask_fu = score.fu > 0

    han_answer = _to_int(body.get("han"))
    fu_answer = _to_int(body.get("fu"))
    points_text = body.get("points") or ""
    points_answer = parse_points(points_text) if points_text else None

    return 200, {
        "hanOk": han_answer is not None and han_answer == score.han,
        "fuOk": (not ask_fu) or (fu_answer is not None and fu_answer == score.fu),
        "pointsOk": points_answer is not None and check_points(points_answer, score),
        "askFu": ask_fu,
        "yourPoints": points_text.strip(),
        "pointsParsed": points_answer is not None,
        "correct": score_to_dict(score, problem),
    }


def _to_int(value: Any) -> Optional[int]:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


class QuizHandler(BaseHTTPRequestHandler):
    server_version = "MahjongQuiz/0.1"

    # --- ルーティング -------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler の命名規約)
        path, query = self._split_path()

        if path == "/api/problem":
            difficulty = query.get("difficulty", "normal")
            if difficulty not in DIFFICULTIES:
                difficulty = "normal"
            use_presets = query.get("preset") in {"1", "true", "yes"}
            try:
                self._send_json(200, build_problem_payload(difficulty, use_presets))
            except RuntimeError as error:
                self._send_json(500, {"error": str(error)})
            return

        self._send_static("/index.html" if path == "/" else path)

    def do_POST(self) -> None:  # noqa: N802
        path, _ = self._split_path()
        if path != "/api/answer":
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "不正なリクエストです"})
            return

        status, payload = build_answer_payload(body)
        self._send_json(status, payload)

    # --- ヘルパー -----------------------------------------------------------

    def _split_path(self) -> Tuple[str, Dict[str, str]]:
        raw_path, _, raw_query = self.path.partition("?")
        query = {}
        for pair in raw_query.split("&"):
            if "=" in pair:
                key, _, value = pair.partition("=")
                query[key] = value
        return raw_path, query

    def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _send_static(self, path: str) -> None:
        # ディレクトリを抜け出すパスを弾く
        relative = os.path.normpath(path.lstrip("/"))
        if relative.startswith("..") or os.path.isabs(relative):
            self._send_json(403, {"error": "forbidden"})
            return

        full_path = os.path.join(STATIC_DIR, relative)
        if not os.path.isfile(full_path):
            self._send_json(404, {"error": "not found"})
            return

        content_type, _ = mimetypes.guess_type(full_path)
        with open(full_path, "rb") as handle:
            data = handle.read()

        self.send_response(200)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args) -> None:
        """アクセスログは静かに（エラーだけ出す）。"""
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(format, *args)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="麻雀 点数計算クイズ（ブラウザ版）")
    parser.add_argument("--port", type=int, default=8765, help="待ち受けポート（既定: 8765）")
    parser.add_argument("--host", default="127.0.0.1", help="待ち受けアドレス（既定: 127.0.0.1）")
    parser.add_argument("--no-browser", action="store_true", help="ブラウザを自動で開かない")
    args = parser.parse_args(argv)

    url = f"http://{args.host}:{args.port}/"
    server = ThreadingHTTPServer((args.host, args.port), QuizHandler)
    print(f"🀄 麻雀 点数計算クイズ  →  {url}")
    print("   終了するには Ctrl+C")

    if not args.no_browser:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n終了しました。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
