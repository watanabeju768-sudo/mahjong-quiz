"""mahjong ライブラリを使った役判定・点数計算のラッパー。

計算そのものはすべて `mahjong` ライブラリに任せ、ここでは
「クイズで使いやすい形（日本語ラベル付き）」に整形することに専念する。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, NamedTuple, Optional, Sequence, Tuple

from mahjong.constants import CHUN, HAKU, HATSU
from mahjong.hand_calculating.divider import HandDivider
from mahjong.hand_calculating.fu import FuCalculator
from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig, OptionalRules
from mahjong.tile import TilesConverter

from .naming import (
    NON_YAKU_NAMES,
    fu_reason_description,
    fu_reason_ja,
    fu_reason_reading,
    yaku_description,
    yaku_level_description,
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
_DIVIDER = HandDivider()
_FU_CALCULATOR = FuCalculator()


class YakuLine(NamedTuple):
    """成立した役 1 つ。reading は読み仮名、description はひとこと説明（未登録なら空文字）。"""

    name: str
    reading: str
    han: int
    description: str = ""


class FuLine(NamedTuple):
    """符の内訳 1 行。tiles はその符の元になった牌（34 形式。特定できなければ空）。"""

    reason: str
    reading: str
    fu: int
    description: str = ""
    tiles: Tuple[int, ...] = ()


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

    def level_description(self) -> str:
        """満貫・跳満などの説明。該当しなければ空文字。"""
        return yaku_level_description(self.level_text())


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
        yaku.append(YakuLine(name, yaku_reading(name), han or 0, yaku_description(name)))

    raw_details = response.fu_details or []
    fu_tiles = _fu_source_tiles(problem, raw_details)
    fu_details: List[FuLine] = []
    for detail, tiles in zip(raw_details, fu_tiles):
        reason = fu_reason_ja(detail["reason"])
        fu_details.append(
            FuLine(
                reason,
                fu_reason_reading(reason),
                detail["fu"],
                fu_reason_description(reason, detail["fu"]),
                tuple(tiles),
            )
        )

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


_PON_KAN_REASONS = {
    FuCalculator.CLOSED_PON,
    FuCalculator.OPEN_PON,
    FuCalculator.CLOSED_TERMINAL_PON,
    FuCalculator.OPEN_TERMINAL_PON,
    FuCalculator.CLOSED_KAN,
    FuCalculator.OPEN_KAN,
    FuCalculator.CLOSED_TERMINAL_KAN,
    FuCalculator.OPEN_TERMINAL_KAN,
}
_PAIR_REASONS = {FuCalculator.VALUED_PAIR, FuCalculator.DOUBLE_VALUED_PAIR, FuCalculator.PAIR_WAIT}
_WAIT_REASONS = {FuCalculator.PENCHAN, FuCalculator.KANCHAN}


def _fu_source_tiles(problem, fu_details: Sequence[dict]) -> List[List[int]]:
    """符の内訳 1 行ごとに、その符の元になった牌（34 形式）を返す。

    ライブラリは符の理由しか返さないので、ライブラリ自身の手牌分解と符計算を
    もう一度呼び、まったく同じ内訳になる分解を探して牌を対応付ける。
    応答の内訳は符の大きい順に並べ替えられている（HandResponse の仕様）ので、
    こちらも同じ安定ソートをかけてから比べる。
    符の値は計算し直さない。見つからなければ全行を空にして、牌の表示を省くだけにする。
    """
    empty: List[List[int]] = [[] for _ in fu_details]
    config = build_config(problem)
    melds = problem.melds or []
    opened_melds = [meld.tiles_34 for meld in melds if meld.opened]
    valued_tiles = [HAKU, HATSU, CHUN, config.player_wind, config.round_wind]
    tiles34 = TilesConverter.to_34_array(problem.tiles136)

    for hand in _DIVIDER.divide_hand(tiles34, melds):
        for win_group in _CALCULATOR._find_win_groups(problem.win_tile136, hand, opened_melds):
            details, _ = _FU_CALCULATOR.calculate_fu(
                hand, problem.win_tile136, win_group, config, valued_tiles, melds
            )
            tiles = _match_tiles(details, hand, win_group, problem.win_tile136 // 4)
            ordered = sorted(zip(details, tiles), key=lambda item: item[0]["fu"], reverse=True)
            if [detail for detail, _ in ordered] == list(fu_details):
                return [group for _, group in ordered]
    return empty


def _match_tiles(details, hand, win_group, win_tile34: int) -> List[List[int]]:
    """同じ内訳になった分解から、各行の牌を拾う。刻子・槓子は分解の並び順に出てくる。"""
    pairs = [group for group in hand if len(group) == 2]
    pons = iter(group for group in hand if len(group) >= 3 and group[0] == group[1])
    result: List[List[int]] = []
    for detail in details:
        reason = detail["reason"]
        if reason in _WAIT_REASONS:
            result.append(list(win_group))
        elif reason in _PAIR_REASONS and len(pairs) == 1:
            result.append(list(pairs[0]))
        elif reason in _PON_KAN_REASONS:
            result.append(list(next(pons, [])))
        elif reason == FuCalculator.TSUMO:
            result.append([win_tile34])
        else:
            result.append([])
    return result


def try_calculate(problem) -> Optional[Score]:
    """calculate() の例外を出さない版。成立しない手なら None を返す。"""
    try:
        return calculate(problem)
    except ScoringError:
        return None
