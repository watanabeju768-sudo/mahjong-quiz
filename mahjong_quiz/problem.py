"""クイズの「問題」（和了形＋状況）の定義と、ランダム生成。"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

from mahjong.constants import EAST, NORTH, SOUTH, WEST
from mahjong.meld import Meld
from mahjong.tile import TilesConverter

from .tiles import counts_to_136, format_tiles, to_34_counts

WIND_NAMES = {EAST: "東", SOUTH: "南", WEST: "西", NORTH: "北"}
ALL_WINDS = [EAST, SOUTH, WEST, NORTH]

MELD_TYPE_NAMES = {
    Meld.CHI: "チー",
    Meld.PON: "ポン",
    Meld.KAN: "カン",
    Meld.SHOUMINKAN: "加槓",
}


@dataclass
class Problem:
    """1 問分の和了形と状況。

    tiles136 は副露牌も含めた 14 枚（槓がある場合は 15 枚以上）を表す。
    """

    tiles136: List[int]
    win_tile136: int
    melds: List[Meld] = field(default_factory=list)
    dora_indicators136: List[int] = field(default_factory=list)
    is_tsumo: bool = False
    is_riichi: bool = False
    is_ippatsu: bool = False
    player_wind: int = EAST
    round_wind: int = EAST
    title: Optional[str] = None
    note: Optional[str] = None

    @property
    def is_dealer(self) -> bool:
        """親（東家）かどうか。"""
        return self.player_wind == EAST

    @property
    def is_open_hand(self) -> bool:
        """副露しているか（門前でないか）。"""
        return bool(self.melds)

    @property
    def concealed_tiles136(self) -> List[int]:
        """副露牌を除いた手牌。"""
        meld_tiles = {tile for meld in self.melds for tile in meld.tiles}
        return [tile for tile in self.tiles136 if tile not in meld_tiles]

    def wind_text(self) -> str:
        """「東場 / 南家」のような場風・自風の表示。"""
        return f"{WIND_NAMES[self.round_wind]}場 / {WIND_NAMES[self.player_wind]}家"

    def seat_text(self) -> str:
        """親・子の表示。"""
        return "親" if self.is_dealer else "子"

    def win_type_text(self) -> str:
        """ツモ / ロンの表示。"""
        return "ツモ" if self.is_tsumo else "ロン"

    def condition_texts(self) -> List[str]:
        """立直・一発などの付帯条件を一覧にする。"""
        conditions = []
        if self.is_riichi:
            conditions.append("立直")
        if self.is_ippatsu:
            conditions.append("一発")
        return conditions

    def meld_texts(self) -> List[str]:
        """副露を「チー 456p」のような文字列にする。"""
        return [
            f"{MELD_TYPE_NAMES.get(meld.type, meld.type)} {format_tiles(meld.tiles)}"
            for meld in self.melds
        ]


# --- 問題を組み立てるためのヘルパー ----------------------------------------


def make_problem(
    man: str = "",
    pin: str = "",
    sou: str = "",
    honors: str = "",
    win_tile: str = "",
    melds: Sequence = (),
    dora_indicator: str = "",
    **kwargs,
) -> Problem:
    """文字列指定から Problem を作る（定義済み問題やテスト用）。

    例::

        make_problem(man="123", pin="456789", sou="22", honors="111",
                     win_tile="sou:2", dora_indicator="man:9",
                     is_tsumo=True, player_wind=EAST)

    win_tile / dora_indicator は "man:3" "honors:5" のように
    「スート名:数字」で指定する。
    """
    tiles136 = TilesConverter.string_to_136_array(man=man, pin=pin, sou=sou, honors=honors)
    return Problem(
        tiles136=tiles136,
        win_tile136=_parse_tile(win_tile),
        melds=list(melds),
        dora_indicators136=[_parse_tile(dora_indicator)] if dora_indicator else [],
        **kwargs,
    )


def make_meld(meld_type: str, man: str = "", pin: str = "", sou: str = "", honors: str = "") -> Meld:
    """副露を作る。牌の指定方法は make_problem と同じ。"""
    return Meld(
        meld_type=meld_type,
        tiles=TilesConverter.string_to_136_array(man=man, pin=pin, sou=sou, honors=honors),
    )


def _parse_tile(spec: str) -> int:
    """"man:3" のような指定を 136 形式の牌 1 枚に変換する。"""
    suit, number = spec.split(":")
    return TilesConverter.string_to_136_array(**{suit: number})[0]


# --- ランダム生成 -----------------------------------------------------------

DIFFICULTIES = ("easy", "normal", "hard")


def generate_problem(
    rng: Optional[random.Random] = None,
    difficulty: str = "normal",
    max_attempts: int = 400,
) -> Problem:
    """ランダムな和了形の問題を作る。

    難易度の目安:
      easy   … 門前のみ・1〜4 翻（役満なし）
      normal … 門前 or 1 副露・役満なし
      hard   … 副露・役満も含めて何でも

    役なしなど成立しない手は捨てて作り直すので、返る Problem は必ず点数がつく。
    """
    if difficulty not in DIFFICULTIES:
        raise ValueError(f"難易度は {DIFFICULTIES} のいずれかです: {difficulty}")

    rng = rng or random.Random()
    # 循環インポートを避けるため、ここで読み込む
    from .scoring import try_calculate

    for _ in range(max_attempts):
        problem = _random_candidate(rng, difficulty)
        if problem is None:
            continue

        score = try_calculate(problem)
        if score is None and not problem.is_open_hand and not problem.is_riichi:
            # 門前で役なしなら、立直をかけていたことにして救済する
            problem.is_riichi = True
            score = try_calculate(problem)
        if score is None:
            continue

        if _accepts(score, problem, difficulty):
            return problem

    raise RuntimeError("問題の生成に失敗しました。難易度を変えて試してください。")


def _accepts(score, problem: Problem, difficulty: str) -> bool:
    """生成された手を、その難易度の問題として採用してよいか。"""
    if difficulty == "easy":
        return not problem.is_open_hand and 1 <= score.han <= 4
    if difficulty == "normal":
        return score.han < 13
    return True


def _random_candidate(rng: random.Random, difficulty: str) -> Optional[Problem]:
    """和了形 1 つと状況をランダムに組み立てる（成立判定は呼び出し側）。"""
    allow_melds = difficulty != "easy"

    if rng.random() < 0.08:
        groups = _random_seven_pairs(rng)
        allow_melds = False
    else:
        groups = _random_standard_groups(rng)
    if groups is None:
        return None

    counts = [0] * 34
    for group in groups:
        for tile34 in group.tiles34:
            counts[tile34] += 1
    tiles136 = counts_to_136(counts)

    melds: List[Meld] = []
    meld_group_indexes: List[int] = []
    if allow_melds and rng.random() < 0.35:
        # 面子（雀頭以外）から 1〜2 個を副露に回す
        candidates = [i for i, group in enumerate(groups) if group.kind != "pair"]
        rng.shuffle(candidates)
        meld_group_indexes = candidates[: rng.choice([1, 1, 2])]

    used136: set = set()
    for index in meld_group_indexes:
        group = groups[index]
        meld_tiles = _pick_tiles136(tiles136, group.tiles34, used136)
        if meld_tiles is None:
            return None
        used136.update(meld_tiles)
        melds.append(
            Meld(
                meld_type=Meld.CHI if group.kind == "run" else Meld.PON,
                tiles=meld_tiles,
            )
        )

    concealed = [tile for tile in tiles136 if tile not in used136]
    if not concealed:
        return None
    win_tile136 = rng.choice(concealed)

    return Problem(
        tiles136=tiles136,
        win_tile136=win_tile136,
        melds=melds,
        dora_indicators136=[_random_dora_indicator(rng, counts)],
        is_tsumo=rng.random() < 0.5,
        is_riichi=(not melds) and rng.random() < 0.5,
        player_wind=rng.choice(ALL_WINDS),
        round_wind=rng.choice([EAST, EAST, SOUTH]),
    )


@dataclass
class _Group:
    """面子または雀頭。kind は "run" / "triplet" / "pair"。"""

    kind: str
    tiles34: List[int]


def _random_standard_groups(rng: random.Random) -> Optional[List[_Group]]:
    """4 面子 1 雀頭をランダムに選ぶ。同じ牌が 5 枚以上にならないようにする。"""
    counts = [0] * 34
    groups: List[_Group] = []

    def try_add(group: _Group) -> bool:
        for tile34 in group.tiles34:
            if counts[tile34] + group.tiles34.count(tile34) > 4:
                return False
        for tile34 in group.tiles34:
            counts[tile34] += 1
        groups.append(group)
        return True

    for _ in range(4):
        for _attempt in range(40):
            if rng.random() < 0.6:
                suit = rng.randrange(3)
                start = rng.randrange(7)
                group = _Group("run", [suit * 9 + start + i for i in range(3)])
            else:
                tile34 = rng.randrange(34)
                group = _Group("triplet", [tile34] * 3)
            if try_add(group):
                break
        else:
            return None

    for _attempt in range(40):
        tile34 = rng.randrange(34)
        if counts[tile34] <= 2:
            counts[tile34] += 2
            groups.append(_Group("pair", [tile34, tile34]))
            return groups
    return None


def _random_seven_pairs(rng: random.Random) -> Optional[List[_Group]]:
    """七対子の形をランダムに選ぶ（同じ対子の重複は不可）。"""
    tiles = rng.sample(range(34), 7)
    return [_Group("pair", [tile34, tile34]) for tile34 in tiles]


def _pick_tiles136(tiles136: Sequence[int], group_tiles34: Sequence[int], used: set) -> Optional[List[int]]:
    """手牌の中から、指定した牌種に対応する未使用の 136 牌を取り出す。"""
    picked: List[int] = []
    for tile34 in group_tiles34:
        for tile136 in tiles136:
            if tile136 // 4 == tile34 and tile136 not in used and tile136 not in picked:
                picked.append(tile136)
                break
        else:
            return None
    return picked


def _random_dora_indicator(rng: random.Random, hand_counts34: Sequence[int]) -> int:
    """山に残っている牌からドラ表示牌を 1 枚選ぶ。"""
    available = [tile34 for tile34 in range(34) if hand_counts34[tile34] < 4]
    tile34 = rng.choice(available)
    return tile34 * 4 + hand_counts34[tile34]


def describe_hand(problem: Problem) -> str:
    """手牌（副露を除く）の表示用文字列。"""
    return format_tiles(problem.concealed_tiles136)


def hand_counts(problem: Problem) -> List[int]:
    """手牌全体の牌種ごとの枚数。"""
    return to_34_counts(problem.tiles136)
