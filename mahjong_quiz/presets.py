"""学習用の定義済み問題。

「この手で何を覚えてほしいか」がはっきりしている手を並べている。
新しい問題を足すときは PRESET_BUILDERS にビルダー関数を追加するだけでよい。
"""

from __future__ import annotations

from typing import Callable, List

from mahjong.constants import EAST, SOUTH
from mahjong.meld import Meld

from .problem import Problem, make_meld, make_problem


def _pinfu_tanyao() -> Problem:
    return make_problem(
        man="234",
        pin="345678",
        sou="23455",
        win_tile="sou:4",
        dora_indicator="man:9",
        is_tsumo=False,
        player_wind=SOUTH,
        round_wind=EAST,
        title="平和と断幺九の基本形",
        note="全部順子・雀頭が役牌以外・両面待ち＝平和。20符に門前ロンの10符で30符。",
    )


def _riichi_pinfu_tsumo() -> Problem:
    return make_problem(
        man="345678",
        pin="34577",
        sou="678",
        win_tile="man:6",
        dora_indicator="sou:9",
        is_tsumo=True,
        is_riichi=True,
        player_wind=SOUTH,
        round_wind=EAST,
        title="平和ツモの20符",
        note="平和ツモはツモの2符を加えず20符固定（このアプリの採用ルール）。",
    )


def _chiitoitsu() -> Problem:
    return make_problem(
        man="1144",
        pin="2277",
        sou="3399",
        honors="11",
        win_tile="honors:1",
        dora_indicator="pin:1",
        is_tsumo=False,
        player_wind=SOUTH,
        round_wind=EAST,
        title="七対子は25符固定",
        note="七対子は符を積み上げず常に25符。ドラが対子で乗ると一気に伸びる。",
    )


def _yakuhai_with_dora() -> Problem:
    return make_problem(
        man="234",
        pin="567",
        sou="23499",
        honors="555",
        win_tile="pin:7",
        dora_indicator="man:1",
        is_tsumo=False,
        player_wind=EAST,
        round_wind=EAST,
        title="役牌1翻＋ドラ",
        note="白の暗刻は8符。ドラは役ではないが翻数には加算される。",
    )


def _sanshoku() -> Problem:
    return make_problem(
        man="234",
        pin="234678",
        sou="23455",
        win_tile="man:4",
        dora_indicator="honors:1",
        is_tsumo=False,
        player_wind=SOUTH,
        round_wind=EAST,
        title="三色同順＋平和＋断幺九",
        note="門前の三色同順は2翻。平和・断幺九と複合して満貫が見えてくる。",
    )


def _honitsu_toitoi() -> Problem:
    return make_problem(
        sou="22288855",
        honors="111555",
        win_tile="sou:5",
        melds=[
            make_meld(Meld.PON, honors="111"),
            make_meld(Meld.PON, honors="555"),
        ],
        dora_indicator="pin:9",
        is_tsumo=False,
        player_wind=EAST,
        round_wind=EAST,
        title="鳴いた混一色＋対々和",
        note="東場の東家なら東は場風・自風でダブル。副露で混一色は2翻に下がる。",
    )


def _sanankou_heavy_fu() -> Problem:
    return make_problem(
        man="111",
        pin="999",
        sou="555234",
        honors="11",
        win_tile="sou:2",
        dora_indicator="pin:5",
        is_tsumo=False,
        player_wind=EAST,
        round_wind=EAST,
        title="符が積み上がる三暗刻",
        note="么九牌の暗刻は8符、中張牌の暗刻は4符。連風牌の雀頭は4符。",
    )


def _kokushi() -> Problem:
    return make_problem(
        man="19",
        pin="19",
        sou="19",
        honors="11234567",
        win_tile="honors:1",
        dora_indicator="man:5",
        is_tsumo=False,
        player_wind=SOUTH,
        round_wind=EAST,
        title="国士無双十三面",
        note="役満は符を数えない。13種すべて揃った状態で待てば十三面待ち。",
    )


PRESET_BUILDERS: List[Callable[[], Problem]] = [
    _pinfu_tanyao,
    _riichi_pinfu_tsumo,
    _chiitoitsu,
    _yakuhai_with_dora,
    _sanshoku,
    _honitsu_toitoi,
    _sanankou_heavy_fu,
    _kokushi,
]


def load_presets() -> List[Problem]:
    """定義済み問題をすべて生成して返す。"""
    return [build() for build in PRESET_BUILDERS]
