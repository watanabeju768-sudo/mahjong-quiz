"""ターミナル（CUI）で遊ぶクイズ本体。"""

from __future__ import annotations

import random
import re
import sys
from dataclasses import dataclass, field
from typing import Dict, Iterator, List, Optional

from .problem import Problem, generate_problem
from .presets import load_presets
from .scoring import Score, calculate
from .tiles import format_tiles, next_dora_34, tile136_to_string, tile34_to_string

LINE = "=" * 62
THIN = "-" * 62


class QuitGame(Exception):
    """プレイヤーが終了を選んだ。"""


# --- 表示まわり -------------------------------------------------------------


class Style:
    """ANSI エスケープによる装飾。パイプ出力時は自動で無効になる。"""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled and sys.stdout.isatty()

    def _wrap(self, code: str, text: str) -> str:
        return f"\033[{code}m{text}\033[0m" if self.enabled else text

    def bold(self, text: str) -> str:
        return self._wrap("1", text)

    def ok(self, text: str) -> str:
        return self._wrap("32", text)

    def ng(self, text: str) -> str:
        return self._wrap("31", text)

    def info(self, text: str) -> str:
        return self._wrap("36", text)

    def dim(self, text: str) -> str:
        return self._wrap("2", text)


def format_problem(problem: Problem, style: Style) -> str:
    """問題の状況を表示用テキストにまとめる。"""
    lines: List[str] = []

    indicators = " ".join(tile136_to_string(t) for t in problem.dora_indicators136)
    doras = " ".join(
        tile34_to_string(next_dora_34(t // 4)) for t in problem.dora_indicators136
    )

    lines.append(f"  場風 / 自風 : {problem.wind_text()}（{problem.seat_text()}）")
    lines.append(f"  和了り方    : {problem.win_type_text()}")
    if problem.condition_texts():
        lines.append(f"  付帯条件    : {' + '.join(problem.condition_texts())}")
    lines.append(f"  ドラ表示牌  : {indicators}   → ドラは {doras}")
    for text in problem.meld_texts():
        lines.append(f"  副露        : {text}")

    # 手牌は「和了牌を除いた 13 枚」＋「和了牌」の形で見せる
    concealed = list(problem.concealed_tiles136)
    concealed.remove(problem.win_tile136)
    hand = format_tiles(concealed)
    win = tile136_to_string(problem.win_tile136)
    lines.append(
        f"  手牌        : {style.bold(hand)}  ＋ "
        f"{style.info(win)}（{problem.win_type_text()}）"
    )
    return "\n".join(lines)


def _with_reading(name: str, reading: str, style: Style) -> str:
    """「平和（ピンフ）」のように読み仮名を添える。読みがなければ名前だけ。"""
    if not reading:
        return name
    return f"{name}{style.dim(f'（{reading}）')}"


def format_explanation(problem: Problem, score: Score, style: Style) -> str:
    """役・符・点数の解説をまとめる。"""
    lines: List[str] = []

    lines.append(style.bold("【成立している役】"))
    if score.yaku:
        for line in score.yaku:
            lines.append(f"    ・{_with_reading(line.name, line.reading, style)}  {line.han}翻")
    else:
        lines.append("    ・（役なし）")
    if score.dora:
        lines.append(f"    ・ドラ  {score.dora}翻  ※役ではないが翻数に加算")
    lines.append(f"    合計 {style.bold(str(score.han) + '翻')}")

    lines.append("")
    lines.append(style.bold("【符計算の内訳】"))
    if score.fu_details:
        raw = 0
        for line in score.fu_details:
            raw += line.fu
            lines.append(
                f"    ・{_with_reading(line.reason, line.reading, style)}  {line.fu}符"
            )
        if raw != score.fu:
            lines.append(f"    小計 {raw}符 → 切り上げて {style.bold(str(score.fu) + '符')}")
        else:
            lines.append(f"    合計 {style.bold(str(score.fu) + '符')}")
    else:
        lines.append("    ・役満のため符は数えません")

    lines.append("")
    lines.append(style.bold("【点数】"))
    level = score.level_text()
    header = f"{score.han}翻 {score.fu}符" if score.fu else f"{score.han}翻"
    if level:
        header += f"（{_with_reading(level, score.level_reading(), style)}）"
    lines.append(f"    {header} … {problem.seat_text()}の{problem.win_type_text()}")
    lines.append(f"    {style.bold(score.payment_text())}")

    if problem.note:
        lines.append("")
        lines.append(style.dim(f"ポイント: {problem.note}"))
    return "\n".join(lines)


# --- 回答の解析 -------------------------------------------------------------

_ALL_SUFFIX = re.compile(r"^(\d+)(?:オール|オ-ル|all)$", re.IGNORECASE)
_SPLIT_PAYMENT = re.compile(r"^(\d+)\s*[/／\-ー]\s*(\d+)$")
_PLAIN_NUMBER = re.compile(r"^(\d+)$")


def parse_points(text: str) -> Optional[Dict[str, int]]:
    """点数の回答を解析する。

    受け付ける形式:
      "7700"          … 合計点
      "2000オール"     … 親のツモ（子 1 人あたりの支払い）
      "1300/2600"     … 子のツモ（子からの支払い / 親からの支払い）
    """
    cleaned = text.strip().replace(",", "").replace("点", "").replace(" ", "")
    if not cleaned:
        return None

    match = _ALL_SUFFIX.match(cleaned)
    if match:
        return {"each": int(match.group(1))}

    match = _SPLIT_PAYMENT.match(cleaned)
    if match:
        return {"child": int(match.group(1)), "dealer": int(match.group(2))}

    match = _PLAIN_NUMBER.match(cleaned)
    if match:
        return {"total": int(match.group(1))}

    return None


def check_points(answer: Optional[Dict[str, int]], score: Score) -> bool:
    """点数の回答が正しいか判定する。解析できなかった回答（None）は不正解。"""
    if not answer:
        return False
    if "total" in answer:
        return answer["total"] == score.total
    if "each" in answer:
        return score.is_tsumo and score.is_dealer and answer["each"] == score.main
    if "child" in answer and "dealer" in answer:
        if not score.is_tsumo:
            return False
        if score.is_dealer:
            # 親のツモは全員同額。"4000/4000" のような書き方も許容する。
            return answer["child"] == answer["dealer"] == score.main
        return answer["child"] == score.additional and answer["dealer"] == score.main
    return False


# --- 入力 -------------------------------------------------------------------


def _read(prompt: str) -> str:
    """1 行読む。q で終了、空行は「わからない（降参）」扱い。"""
    try:
        text = input(prompt)
    except (EOFError, KeyboardInterrupt):
        raise QuitGame
    if text.strip().lower() in {"q", "quit", "exit"}:
        raise QuitGame
    return text


def ask_int(prompt: str) -> Optional[int]:
    """整数を 1 つ聞く。空行を入れたら None（降参）。"""
    while True:
        text = _read(prompt).strip()
        if not text:
            return None
        if text.isdigit():
            return int(text)
        print("  数字で入力してください（q で終了・空行で降参）")


def ask_points(prompt: str) -> Optional[Dict[str, int]]:
    """点数を聞く。空行を入れたら None（降参）。"""
    while True:
        text = _read(prompt)
        if not text.strip():
            return None
        answer = parse_points(text)
        if answer is not None:
            return answer
        print("  例: 7700 / 2000オール / 1300-2600（q で終了・空行で降参）")


# --- 出題 -------------------------------------------------------------------


@dataclass
class Stats:
    """成績の集計。"""

    total: int = 0
    han: int = 0
    fu: int = 0
    points: int = 0
    perfect: int = 0
    fu_asked: int = 0

    def report(self, style: Style) -> str:
        if self.total == 0:
            return "1 問も解かずに終了しました。"
        lines = [
            style.bold("=== 成績 ==="),
            f"  出題数    : {self.total}",
            f"  翻数正解  : {self.han}/{self.total}",
            f"  符正解    : {self.fu}/{self.fu_asked}" if self.fu_asked else "  符正解    : -",
            f"  点数正解  : {self.points}/{self.total}",
            f"  全項目正解: {style.bold(f'{self.perfect}/{self.total}')}",
        ]
        return "\n".join(lines)


@dataclass
class QuizSession:
    """クイズの進行役。"""

    style: Style = field(default_factory=Style)
    batch: bool = False
    stats: Stats = field(default_factory=Stats)

    def play(self, problems: Iterator[Problem]) -> Stats:
        """問題を順に出題する。"""
        try:
            for number, problem in enumerate(problems, start=1):
                self._play_one(number, problem)
        except QuitGame:
            print("\n中断しました。")
        return self.stats

    def _play_one(self, number: int, problem: Problem) -> None:
        score = calculate(problem)
        style = self.style

        print()
        print(style.info(LINE))
        title = f" 第 {number} 問"
        if problem.title:
            title += f"  【{problem.title}】"
        print(style.info(title))
        print(style.info(LINE))
        print(format_problem(problem, style))
        print(THIN)

        is_yakuman = score.fu == 0
        if self.batch:
            han_answer, fu_answer, point_answer = self._ask_batch(is_yakuman)
        else:
            print(style.dim("  ※ q で終了、空行で降参（答えを見る）"))
            han_answer = ask_int("  翻数は？   > ")
            if is_yakuman:
                print(style.dim("  （役満なので符は数えません）"))
                fu_answer = None
            else:
                fu_answer = ask_int("  符は？     > ")
            point_answer = ask_points("  点数は？   > ")

        self.stats.total += 1
        if not is_yakuman:
            self.stats.fu_asked += 1

        han_ok = han_answer == score.han
        fu_ok = is_yakuman or fu_answer == score.fu
        point_ok = point_answer is not None and check_points(point_answer, score)

        print()
        print(self._verdict_line("翻数", han_ok, han_answer, f"{score.han}翻"))
        if not is_yakuman:
            print(self._verdict_line("符", fu_ok, fu_answer, f"{score.fu}符"))
        print(self._verdict_line("点数", point_ok, point_answer, score.payment_text()))

        if han_ok:
            self.stats.han += 1
        if fu_ok:
            self.stats.fu += 1
        if point_ok:
            self.stats.points += 1

        print()
        if han_ok and fu_ok and point_ok:
            self.stats.perfect += 1
            print(style.ok("  すばらしい！ 完璧です 🀄"))
            names = "・".join(
                f"{line.name}（{line.reading}）" if line.reading else line.name
                for line in score.yaku
            )
            print(style.dim(f"  （{names or '役なし'}"
                            f"{f'・ドラ{score.dora}' if score.dora else ''}）"))
        else:
            print(style.ng("  惜しい！ 内訳を確認しましょう。"))
            print()
            print(format_explanation(problem, score, style))

    def _ask_batch(self, is_yakuman: bool):
        """「翻,符,点数」をまとめて 1 行で受け取る。"""
        style = self.style
        example = "例) 4,30,7700" if not is_yakuman else "例) 13,0,32000"
        print(style.dim(f"  ※ 翻,符,点数 をカンマ区切りで入力（{example} / q で終了・空行で降参）"))
        while True:
            text = _read("  回答 > ")
            if not text.strip():
                return None, None, None
            parts = [part.strip() for part in text.split(",")]
            if len(parts) != 3:
                print("  3 つの値をカンマ区切りで入力してください")
                continue
            han_text, fu_text, point_text = parts
            if not han_text.isdigit() or not fu_text.isdigit():
                print("  翻数と符は数字で入力してください")
                continue
            point_answer = parse_points(point_text)
            if point_answer is None:
                print("  点数の書式が不正です（例: 7700 / 2000オール / 1300-2600）")
                continue
            return int(han_text), int(fu_text), point_answer

    def _verdict_line(self, label: str, ok: bool, answer, correct: str) -> str:
        style = self.style
        mark = style.ok("○ 正解") if ok else style.ng("× 不正解")
        if answer is None:
            shown = "（降参）"
        elif isinstance(answer, dict):
            shown = _format_point_answer(answer)
        else:
            shown = str(answer)
        return f"  {label:<4} {mark}   あなたの回答: {shown}   正解: {correct}"


def _format_point_answer(answer: Dict[str, int]) -> str:
    if "total" in answer:
        return f"{answer['total']}点"
    if "each" in answer:
        return f"{answer['each']}点オール"
    return f"{answer['child']} / {answer['dealer']}"


# --- 問題の供給 -------------------------------------------------------------


def problem_stream(
    count: int,
    difficulty: str = "normal",
    use_presets: bool = False,
    seed: Optional[int] = None,
) -> Iterator[Problem]:
    """出題する問題を順に返す。

    use_presets が True なら定義済み問題をシャッフルして出題し、
    足りない分はランダム生成で補う。
    """
    rng = random.Random(seed)
    queue: List[Problem] = []
    if use_presets:
        queue = load_presets()
        rng.shuffle(queue)

    for index in range(count):
        if index < len(queue):
            yield queue[index]
        else:
            yield generate_problem(rng=rng, difficulty=difficulty)


def run(
    count: int = 5,
    difficulty: str = "normal",
    use_presets: bool = False,
    batch: bool = False,
    seed: Optional[int] = None,
    color: bool = True,
) -> Stats:
    """クイズを 1 セッション実行する。"""
    style = Style(enabled=color)
    print(style.bold("\n🀄 麻雀 点数計算クイズ"))
    print(style.dim("  ルール: 喰いタンあり / 赤ドラなし / 平和ツモ 20符 / 数え役満あり"))

    session = QuizSession(style=style, batch=batch)
    stats = session.play(problem_stream(count, difficulty, use_presets, seed))

    print()
    print(stats.report(style))
    return stats
