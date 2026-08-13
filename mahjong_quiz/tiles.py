"""牌の表現とフォーマット。

mahjong ライブラリは牌を 2 つの形式で扱う。

- 34 形式: 牌の種類のインデックス (0-33)
  0-8   = 1m-9m (萬子)
  9-17  = 1p-9p (筒子)
  18-26 = 1s-9s (索子)
  27-33 = 東 南 西 北 白 發 中
- 136 形式: 同じ牌 4 枚を区別した実体のインデックス (0-135)。tile136 // 4 == tile34。

このモジュールは 34/136 の相互変換と、日本語での表示を担当する。
"""

from __future__ import annotations

from typing import Iterable, List, Sequence

# 牌種の数
TILE_TYPES = 34

# 字牌の表示名（34 形式の 27-33 に対応）
HONOR_NAMES = ["東", "南", "西", "北", "白", "發", "中"]

# 数牌のスート記号（0=萬子, 1=筒子, 2=索子）
SUIT_SYMBOLS = ["m", "p", "s"]
SUIT_NAMES = ["萬子", "筒子", "索子"]

# 么九牌（1・9・字牌）の 34 インデックス
TERMINAL_AND_HONOR_34 = [0, 8, 9, 17, 18, 26] + list(range(27, 34))


def tile34_to_string(tile34: int) -> str:
    """34 形式の牌 1 枚を "3p" や "東" のような文字列にする。"""
    if tile34 >= 27:
        return HONOR_NAMES[tile34 - 27]
    return f"{tile34 % 9 + 1}{SUIT_SYMBOLS[tile34 // 9]}"


def tile136_to_string(tile136: int) -> str:
    """136 形式の牌 1 枚を文字列にする。"""
    return tile34_to_string(tile136 // 4)


def to_34_counts(tiles136: Iterable[int]) -> List[int]:
    """136 形式のリストを、牌種ごとの枚数配列 (長さ 34) に変換する。"""
    counts = [0] * TILE_TYPES
    for tile in tiles136:
        counts[tile // 4] += 1
    return counts


def counts_to_136(counts34: Sequence[int]) -> List[int]:
    """枚数配列 (長さ 34) を 136 形式のリストに変換する。"""
    tiles: List[int] = []
    for tile34, count in enumerate(counts34):
        for i in range(count):
            tiles.append(tile34 * 4 + i)
    return tiles


def format_tiles(tiles136: Iterable[int]) -> str:
    """136 形式のリストを "123456m 456p 678s 東東" 形式で表示する。

    数牌はスートごとにまとめ、字牌は漢字を並べる。
    """
    counts = to_34_counts(tiles136)
    parts: List[str] = []

    for suit in range(3):
        digits = ""
        for number in range(9):
            digits += str(number + 1) * counts[suit * 9 + number]
        if digits:
            parts.append(f"{digits}{SUIT_SYMBOLS[suit]}")

    honors = ""
    for index in range(27, TILE_TYPES):
        honors += HONOR_NAMES[index - 27] * counts[index]
    if honors:
        parts.append(honors)

    return " ".join(parts)


def next_dora_34(indicator34: int) -> int:
    """ドラ表示牌からドラ本体（次の牌）の 34 インデックスを求める。

    数牌は 9 の次が 1、風牌は東南西北の循環、三元牌は白發中の循環。
    """
    if indicator34 < 27:  # 数牌
        suit, number = divmod(indicator34, 9)
        return suit * 9 + (number + 1) % 9
    if indicator34 < 31:  # 風牌 (東南西北)
        return 27 + (indicator34 - 27 + 1) % 4
    return 31 + (indicator34 - 31 + 1) % 3  # 三元牌 (白發中)


def count_dora(tiles136: Iterable[int], indicators136: Iterable[int]) -> int:
    """手牌 14 枚に含まれるドラの枚数を数える。"""
    counts = to_34_counts(tiles136)
    return sum(counts[next_dora_34(indicator // 4)] for indicator in indicators136)


def is_terminal_or_honor(tile34: int) -> bool:
    """么九牌（1・9・字牌）かどうか。"""
    return tile34 in TERMINAL_AND_HONOR_34
