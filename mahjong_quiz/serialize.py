"""Problem / Score を Web フロントエンド向けの JSON 互換 dict に変換する。

CUI 版（quiz.py）と同じ `problem` / `scoring` を使い、表示層だけを差し替える。
牌は 34 形式のインデックスで渡し、絵柄の組み立てはフロント側に任せる。
"""

from __future__ import annotations

from typing import Any, Dict, List

from .problem import MELD_TYPE_NAMES, WIND_NAMES, Problem
from .scoring import Score
from .tiles import next_dora_34


def problem_to_dict(problem: Problem, problem_id: str, ask_fu: bool) -> Dict[str, Any]:
    """出題内容（答えを含まない）を dict にする。"""
    concealed = sorted(tile // 4 for tile in problem.concealed_tiles136)
    concealed.remove(problem.win_tile136 // 4)

    return {
        "id": problem_id,
        "title": problem.title,
        # 「東」「南」のような風の字だけを返し、「〜場」「〜家」はフロントで付ける
        "roundWind": WIND_NAMES[problem.round_wind],
        "playerWind": WIND_NAMES[problem.player_wind],
        "seat": problem.seat_text(),
        "winType": problem.win_type_text(),
        "isTsumo": problem.is_tsumo,
        "isDealer": problem.is_dealer,
        "conditions": problem.condition_texts(),
        "doraIndicators": [tile // 4 for tile in problem.dora_indicators136],
        "dora": [next_dora_34(tile // 4) for tile in problem.dora_indicators136],
        "melds": [
            {
                "type": MELD_TYPE_NAMES.get(meld.type, meld.type),
                "tiles": sorted(tile // 4 for tile in meld.tiles),
            }
            for meld in problem.melds
        ],
        "concealed": concealed,
        "winTile": problem.win_tile136 // 4,
        # 役満は符を数えないので、フロントでも符の入力欄を隠す
        "askFu": ask_fu,
    }


def score_to_dict(score: Score, problem: Problem) -> Dict[str, Any]:
    """答え合わせ用の正解データを dict にする。"""
    fu_details: List[Dict[str, Any]] = [
        {"reason": line.reason, "reading": line.reading, "fu": line.fu}
        for line in score.fu_details
    ]
    return {
        "han": score.han,
        "fu": score.fu,
        "fuRaw": sum(detail["fu"] for detail in fu_details),
        "fuDetails": fu_details,
        "yaku": [
            {"name": line.name, "reading": line.reading, "han": line.han}
            for line in score.yaku
        ],
        "dora": score.dora,
        "total": score.total,
        # main / additional は点数の答え合わせに使う（ロン=総点、子のツモ=親/子の支払い）
        "main": score.main,
        "additional": score.additional,
        "isTsumo": score.is_tsumo,
        "isDealer": score.is_dealer,
        "payment": score.payment_text(),
        "level": score.level_text(),
        "levelReading": score.level_reading(),
        "seat": problem.seat_text(),
        "winType": problem.win_type_text(),
        "note": problem.note,
    }
