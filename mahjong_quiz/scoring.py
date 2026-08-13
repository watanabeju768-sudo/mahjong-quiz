"""mahjong ライブラリを使った役判定・点数計算のラッパー。

計算そのものはすべて `mahjong` ライブラリに任せ、ここでは
「クイズで使いやすい形（日本語ラベル付き）」に整形することに専念する。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, NamedTuple, Optional

from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig, OptionalRules

from .naming import (
    NON_YAKU_NAMES,
    fu_reason_ja,
    fu_reason_reading,
    yaku_level_ja,
    yaku_level_reading,
    yaku_name_ja,
    yaku_reading,
)
from .tiles import count_dora

# アプリ全体で使う標準ルール設定。
#   has_open_tanyao   : 喰いタンあり
#   has_aka_dora      : 赤ドラなし（フェーズ1では未対応）
#   fu_for_pinfu_tsumo: 平和ツモは 20 符（ツモの 2 符を加えない）
#   fu_for_open_pinfu : 喰い平和形は 30 符
DEFAULT_RULES = OptionalRules(
    has_open_tanyao=True,
    has_aka_dora=False,
    fu_for_pinfu_tsumo=False,
    fu_for_open_pinfu=True,
)

_CALCULATOR = HandCalculator()


class YakuLine(NamedTuple):
    """成立した役 1 つ。reading は読み仮名（未登録なら空文字）。"""

    name: str
    reading: str
    han: int


class FuLine(NamedTuple):
    """符の内訳 1 行。"""

    reason: str
    reading: str
    fu: int


@dataclass
class Score:
    """1 つの和了に対する採点結果。"""

    han: int
    fu: int
    total: int
    #: ロン = 放銃者の支払い / 子のツモ = 親の支払い / 親のツモ = 各子の支払い
    main: int
    #: 子のツモのときだけ意味を持つ（子 1 人あたりの支払い）
    additional: int
    is_tsumo: bool
    is_dealer: bool
    dora: int
    level: str = ""
    yaku: List[YakuLine] = field(default_factory=list)
    fu_details: List[FuLine] = field(default_factory=list)

    def payment_text(self) -> str:
        """支払いの内訳を日本語 1 行で表す。"""
        if not self.is_tsumo:
            return f"{self.total}点（放銃者の一括払い）"
        if self.is_dealer:
            return f"{self.main}点オール（子 3 人から {self.main}点ずつ・合計 {self.total}点）"
        return (
            f"{self.additional}点 / {self.main}点"
            f"（子から {self.additional}点ずつ・親から {self.main}点・合計 {self.total}点）"
        )

    def level_text(self) -> str:
        """満貫・跳満などの呼び名。該当しなければ空文字。"""
        return yaku_level_ja(self.level)

    def level_reading(self) -> str:
        """満貫・跳満などの読み。該当しなければ空文字。"""
        return yaku_level_reading(self.level_text())


class ScoringError(Exception):
    """役なしなど、和了として成立しない手を渡されたときのエラー。"""


def build_config(problem) -> HandConfig:
    """Problem から mahjong ライブラリの HandConfig を作る。"""
    return HandConfig(
        is_tsumo=problem.is_tsumo,
        is_riichi=problem.is_riichi,
        is_ippatsu=problem.is_ippatsu,
        player_wind=problem.player_wind,
        round_wind=problem.round_wind,
        options=DEFAULT_RULES,
    )


def calculate(problem) -> Score:
    """Problem を採点して Score を返す。役なしなどの場合は ScoringError。"""
    response = _CALCULATOR.estimate_hand_value(
        tiles=problem.tiles136,
        win_tile=problem.win_tile136,
        melds=problem.melds or None,
        dora_indicators=problem.dora_indicators136 or None,
        config=build_config(problem),
    )

    if response.error is not None or response.cost is None:
        raise ScoringError(response.error or "点数を計算できませんでした")

    is_open = bool(problem.melds)
    yaku: List[YakuLine] = []
    for item in response.yaku or []:
        if item.name in NON_YAKU_NAMES:
            continue  # ドラは役ではないので別枠で数える
        han = item.han_open if is_open else item.han_closed
        name = yaku_name_ja(item.name)
        yaku.append(YakuLine(name, yaku_reading(name), han or 0))

    fu_details: List[FuLine] = []
    for detail in response.fu_details or []:
        reason = fu_reason_ja(detail["reason"])
        fu_details.append(FuLine(reason, fu_reason_reading(reason), detail["fu"]))

    return Score(
        han=response.han,
        fu=response.fu,
        total=response.cost["total"],
        main=response.cost["main"],
        additional=response.cost["additional"],
        is_tsumo=problem.is_tsumo,
        is_dealer=problem.is_dealer,
        dora=count_dora(problem.tiles136, problem.dora_indicators136),
        level=response.cost.get("yaku_level", "") or "",
        yaku=yaku,
        fu_details=fu_details,
    )


def try_calculate(problem) -> Optional[Score]:
    """calculate() の例外を出さない版。成立しない手なら None を返す。"""
    try:
        return calculate(problem)
    except ScoringError:
        return None
