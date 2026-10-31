"""点数計算・回答判定のテスト（標準ライブラリの unittest だけで動く）。

実行::

    .venv/bin/python -m unittest discover -s tests -v
"""

from __future__ import annotations

import json
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mahjong.constants import EAST, SOUTH  # noqa: E402

from mahjong_quiz.presets import load_presets  # noqa: E402
from mahjong_quiz.problem import generate_problem, make_problem  # noqa: E402
from mahjong_quiz.quiz import check_points, parse_points  # noqa: E402
from mahjong_quiz.scoring import Score, calculate  # noqa: E402
from mahjong_quiz.tiles import count_dora, format_tiles, next_dora_34  # noqa: E402


class TestTiles(unittest.TestCase):
    def test_format_tiles(self):
        problem = make_problem(
            man="234", pin="345678", sou="23455", win_tile="sou:4"
        )
        self.assertEqual(format_tiles(problem.tiles136), "234m 345678p 23455s")

    def test_next_dora(self):
        self.assertEqual(next_dora_34(0), 1)  # 1m -> 2m
        self.assertEqual(next_dora_34(8), 0)  # 9m -> 1m
        self.assertEqual(next_dora_34(30), 27)  # 北 -> 東
        self.assertEqual(next_dora_34(33), 31)  # 中 -> 白

    def test_count_dora(self):
        problem = make_problem(
            man="234", pin="345678", sou="23455", win_tile="sou:4", dora_indicator="sou:4"
        )
        # ドラ表示牌 4s → ドラは 5s、手牌に 2 枚
        self.assertEqual(count_dora(problem.tiles136, problem.dora_indicators136), 2)


class TestScoring(unittest.TestCase):
    def test_pinfu_tanyao_ron(self):
        problem = make_problem(
            man="234",
            pin="345678",
            sou="23455",
            win_tile="sou:4",
            player_wind=SOUTH,
            round_wind=EAST,
        )
        score = calculate(problem)
        self.assertEqual(score.han, 2)
        self.assertEqual(score.fu, 30)
        self.assertEqual(score.total, 2000)
        self.assertEqual({line.name for line in score.yaku}, {"平和", "断幺九"})
        self.assertEqual({line.reading for line in score.yaku}, {"ピンフ", "タンヤオチュー"})

    def test_pinfu_tsumo_is_20_fu(self):
        problem = make_problem(
            man="345678",
            pin="34577",
            sou="678",
            win_tile="man:6",
            is_tsumo=True,
            is_riichi=True,
            player_wind=SOUTH,
            round_wind=EAST,
        )
        score = calculate(problem)
        self.assertEqual(score.fu, 20)
        self.assertEqual(score.han, 4)
        # 子のツモ: 子 1300 / 親 2600
        self.assertEqual(score.additional, 1300)
        self.assertEqual(score.main, 2600)
        self.assertEqual(score.total, 5200)

    def test_chiitoitsu_is_25_fu(self):
        problem = make_problem(
            man="1144",
            pin="2277",
            sou="3399",
            honors="11",
            win_tile="honors:1",
            player_wind=SOUTH,
            round_wind=EAST,
        )
        score = calculate(problem)
        self.assertEqual(score.fu, 25)

    def test_double_wind_pair_fu(self):
        problem = make_problem(
            man="111",
            pin="999",
            sou="555234",
            honors="11",
            win_tile="sou:2",
            player_wind=EAST,
            round_wind=EAST,
        )
        score = calculate(problem)
        # 30(副底+門前ロン) + 8 + 8 + 4(555s) + 4(連風牌雀頭) = 54 → 60符
        self.assertEqual(score.fu, 60)
        self.assertEqual(score.total, 5800)
        self.assertIn(
            ("連風牌の雀頭", "レンフォンパイのジャントウ", 4),
            [(line.reason, line.reading, line.fu) for line in score.fu_details],
        )

    def test_dora_is_not_listed_as_yaku(self):
        problem = make_problem(
            man="234",
            pin="567",
            sou="23499",
            honors="555",
            win_tile="pin:7",
            dora_indicator="man:1",
            player_wind=EAST,
            round_wind=EAST,
        )
        score = calculate(problem)
        self.assertEqual(score.dora, 1)
        self.assertNotIn("ドラ", [line.name for line in score.yaku])
        self.assertEqual(score.han, 2)  # 役牌白 1 翻 + ドラ 1

    def test_every_japanese_name_has_a_reading(self):
        """役名・符の理由・満貫の呼び名に読みの付け忘れがないこと。"""
        from mahjong_quiz import naming

        pairs = [
            ("役名", naming.YAKU_JA, naming.YAKU_READING),
            ("符の理由", naming.FU_REASON_JA, naming.FU_REASON_READING),
            ("満貫の呼び名", naming.YAKU_LEVEL_JA, naming.YAKU_LEVEL_READING),
        ]
        for label, names, readings in pairs:
            with self.subTest(label=label):
                missing = sorted(set(names.values()) - set(readings))
                self.assertEqual(missing, [], f"{label}に読みがありません: {missing}")

    def test_every_japanese_name_has_a_description(self):
        """役名・符の理由に、初心者向けのひとこと説明の付け忘れがないこと。"""
        from mahjong_quiz import naming

        pairs = [
            ("役名", naming.YAKU_JA, naming.YAKU_DESCRIPTION),
            ("符の理由", naming.FU_REASON_JA, naming.FU_REASON_DESCRIPTION),
        ]
        for label, names, descriptions in pairs:
            with self.subTest(label=label):
                missing = sorted(set(names.values()) - set(descriptions))
                self.assertEqual(missing, [], f"{label}に説明がありません: {missing}")

    def test_fu_lines_point_to_their_tiles(self):
        """符の内訳の各行に、元になった牌（刻子・雀頭）が対応付けられること。"""
        from mahjong_quiz import naming

        problem = make_problem(
            man="111",
            pin="999",
            sou="555234",
            honors="11",
            win_tile="sou:2",
            player_wind=EAST,
            round_wind=EAST,
        )
        score = calculate(problem)
        lines = {line.reason: line for line in score.fu_details}
        self.assertEqual(lines["連風牌の雀頭"].tiles, (27, 27))  # 東東
        self.assertEqual(lines["中張牌の暗刻"].tiles, (22, 22, 22))  # 5索
        self.assertEqual(lines["副底"].tiles, ())
        # 門前ロンの副底は 30 符として返るので、門前加符の説明になる
        self.assertEqual(lines["副底"].description, naming.FU_BASE_DESCRIPTION[30])
        terminal_pons = sorted(
            line.tiles for line in score.fu_details if line.reason == "么九牌の暗刻"
        )
        self.assertEqual(terminal_pons, [(0, 0, 0), (17, 17, 17)])  # 1萬・9筒

    def test_all_presets_are_scorable(self):
        for problem in load_presets():
            with self.subTest(title=problem.title):
                score = calculate(problem)
                self.assertGreaterEqual(score.han, 1)
                self.assertGreater(score.total, 0)


class TestGenerator(unittest.TestCase):
    def test_generated_problems_are_valid(self):
        for seed in range(40):
            with self.subTest(seed=seed):
                problem = generate_problem(rng=random.Random(seed), difficulty="normal")
                self.assertEqual(len(problem.tiles136), 14)
                self.assertIn(problem.win_tile136, problem.concealed_tiles136)
                score = calculate(problem)
                self.assertGreaterEqual(score.han, 1)
                self.assertGreater(score.total, 0)

    def test_easy_difficulty_is_closed_and_small(self):
        for seed in range(20):
            with self.subTest(seed=seed):
                problem = generate_problem(rng=random.Random(seed), difficulty="easy")
                self.assertFalse(problem.is_open_hand)
                self.assertLessEqual(calculate(problem).han, 4)


class TestSerialize(unittest.TestCase):
    def test_problem_dict_hides_answer_and_win_tile(self):
        from mahjong_quiz.serialize import problem_to_dict, score_to_dict

        problem = make_problem(
            man="234",
            pin="345678",
            sou="23455",
            win_tile="sou:4",
            dora_indicator="man:9",
            player_wind=SOUTH,
            round_wind=EAST,
        )
        payload = problem_to_dict(problem, "test-id", ask_fu=True)

        self.assertEqual(payload["roundWind"], "東")
        self.assertEqual(payload["playerWind"], "南")
        self.assertEqual(payload["seat"], "子")
        # 手牌 13 枚（和了牌は winTile として別に持つ）
        self.assertEqual(len(payload["concealed"]), 13)
        self.assertEqual(payload["winTile"], 21)  # 4s
        self.assertEqual(payload["dora"], [0])  # ドラ表示牌 9m → ドラ 1m
        # 答えにあたるキーが混ざっていないこと
        for key in ("han", "fu", "total", "yaku"):
            self.assertNotIn(key, payload)

        answer = score_to_dict(calculate(problem), problem)
        self.assertEqual(answer["han"], 2)
        self.assertEqual(answer["fu"], 30)
        self.assertEqual(answer["fuRaw"], 30)
        self.assertEqual(answer["total"], 2000)


class TestSharedPointCases(unittest.TestCase):
    """JS 版（webapp/static/quiz-core.js）と共通のテストケース。

    同じ tests/points_cases.json を Node 側でも流している
    （`node tests/test_points.mjs`）。両者の挙動がずれたらここで落ちる。
    """

    @classmethod
    def setUpClass(cls):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "points_cases.json")
        with open(path, encoding="utf-8") as handle:
            cls.cases = json.load(handle)

    def test_parse_cases(self):
        for item in self.cases["parse"]:
            with self.subTest(text=item["text"]):
                self.assertEqual(parse_points(item["text"]), item["expected"])

    def test_check_cases(self):
        for item in self.cases["check"]:
            with self.subTest(score=item["score"], text=item["text"]):
                data = self.cases["scores"][item["score"]]
                score = Score(
                    han=1,
                    fu=30,
                    total=data["total"],
                    main=data["main"],
                    additional=data["additional"],
                    is_tsumo=data["isTsumo"],
                    is_dealer=data["isDealer"],
                    dora=0,
                )
                actual = check_points(parse_points(item["text"]), score)
                self.assertEqual(actual, item["expected"])


class TestAnswerParsing(unittest.TestCase):
    def test_parse_formats(self):
        self.assertEqual(parse_points("7700"), {"total": 7700})
        self.assertEqual(parse_points("2000オール"), {"each": 2000})
        self.assertEqual(parse_points("1300-2600"), {"child": 1300, "dealer": 2600})
        self.assertEqual(parse_points("1,300／2,600"), {"child": 1300, "dealer": 2600})
        self.assertIsNone(parse_points("ろくせんてん"))
        self.assertIsNone(parse_points(""))

    def test_check_child_tsumo(self):
        score = Score(
            han=4, fu=20, total=5200, main=2600, additional=1300,
            is_tsumo=True, is_dealer=False, dora=0,
        )
        self.assertTrue(check_points({"total": 5200}, score))
        self.assertTrue(check_points({"child": 1300, "dealer": 2600}, score))
        self.assertFalse(check_points({"child": 2600, "dealer": 1300}, score))
        self.assertFalse(check_points({"each": 1300}, score))

    def test_check_dealer_tsumo(self):
        score = Score(
            han=4, fu=30, total=12000, main=4000, additional=4000,
            is_tsumo=True, is_dealer=True, dora=0,
        )
        self.assertTrue(check_points({"each": 4000}, score))
        self.assertTrue(check_points({"total": 12000}, score))
        self.assertTrue(check_points({"child": 4000, "dealer": 4000}, score))
        self.assertFalse(check_points({"total": 4000}, score))

    def test_check_ron(self):
        score = Score(
            han=2, fu=40, total=3900, main=3900, additional=0,
            is_tsumo=False, is_dealer=True, dora=1,
        )
        self.assertTrue(check_points({"total": 3900}, score))
        self.assertFalse(check_points({"each": 3900}, score))


class TestSharedScoreTable(unittest.TestCase):
    """ヒントの点数早見表（quiz-core.js の scoreFor）の照合用データが、
    mahjong ライブラリの計算結果と一致すること。JS 側は node tests/test_points.mjs で照合する。
    """

    def test_cases_match_library(self):
        from mahjong.hand_calculating.hand_config import HandConfig
        from mahjong.hand_calculating.scores import ScoresCalculator

        from mahjong_quiz.scoring import DEFAULT_RULES

        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "score_table_cases.json")
        with open(path, encoding="utf-8") as handle:
            cases = json.load(handle)["cases"]
        calculator = ScoresCalculator()
        for item in cases:
            with self.subTest(**{k: item[k] for k in ("han", "fu", "isDealer", "isTsumo")}):
                config = HandConfig(
                    is_tsumo=item["isTsumo"],
                    player_wind=EAST if item["isDealer"] else SOUTH,
                    round_wind=EAST,
                    options=DEFAULT_RULES,
                )
                cost = calculator.calculate_scores(item["han"], item["fu"], config)
                self.assertEqual(
                    (cost["main"], cost["additional"], cost["total"]),
                    (item["main"], item["additional"], item["total"]),
                )


if __name__ == "__main__":
    unittest.main()
